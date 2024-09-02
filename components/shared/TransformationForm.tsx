"use client"

import React, { useEffect, useState, useTransition } from 'react'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
  


import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { aspectRatioOptions, creditFee, defaultValues, transformationTypes } from '@/constants'
import { CustomField } from './CustomFields'
import { AspectRatioKey, debounce, deepMergeObjects } from '@/lib/utils'
import MediaUploader from './MediaUploader'
import TransformedImage from './TransformedImage'
import { updateCredits } from '@/lib/actions/user.actions'
import { getCldImageUrl } from 'next-cloudinary'
import { addImage, updateImage } from '@/lib/actions/image.actions'
import { useRouter } from 'next/navigation'
import TransformationPage from '../../app/(root)/transformations/[id]/page';
import { InsufficientCreditsModal } from './InsufficientCreditsModal'

export const formSchema = z.object({ //username: z.string().min(2).max(50),
    title: z.string(),
    aspectRatio: z.string().optional(),
    color: z.string().optional(),
    prompt: z.string().optional(),
    publicId: z.string(),
  })
  
const TransformationForm = ({action, data= null,
userId, type, creditBalance, config= null}:
TransformationFormProps) => {
  

    const transformationType = transformationTypes[type];
    const [image, setImage]= useState(data)
    const [newTransformation, setnewTransformation] = useState<Transformations | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);
    const [transformationConfig, setTransformationConfig] = useState(config)
    const [isPending, startTransition]= useTransition()
    const router= useRouter();

    const initialValues = data && action === 'Update' ? {
        title: data?.title,
        aspectRatio: data?.aspectRatio,
        color: data?.color,
        prompt: data?.prompt,
        publicId: data?.publicId,
    } : defaultValues

    // 1. Define your form.
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: initialValues,
    })
 
 // 2. Define a submit handler.
    async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

        if(data || image){
            const transformationUrl= getCldImageUrl({
                width: image?.width,
                height: image?.height,
                src: image?.publicId,
                ...transformationConfig
            })

            const imageData= {
                title: values.title,
                publicId: image?.publicId,
                transformationType: type,
                width: image?.width,
                height: image?.height,
                config: transformationConfig,
                secureURL: image?.secureURL,
                transformationURL: transformationUrl,
                aspectRatio: values.aspectRatio,
                prompt: values.prompt,
                color: values.color,
            }

            if(action=== 'Add'){
                try{
                    const newImage= await addImage({
                        image: imageData,
                        userId,
                        path: '/'
                    })

                    if(newImage){
                        form.reset()
                        setImage(data)
                        router.push(`/transformations/${newImage._id}`)
                    }
                }catch(error){
                    console.log(error);
                }
            }

            if(action === 'Update') {
                try {
                    const updatedImage = await updateImage({
                        image: {
                            ...imageData,
                            _id: data._id
                        },
                        userId,
                        path: `/transformations/${data._id}`
                    })
        
                    if(updatedImage) {
                        router.push(`/transformations/${updatedImage._id}`)
                    }
                } catch (error) {
                  console.log(error);
                }
            }
        }
        
        setIsSubmitting(false)
    
    }
    
  

    // this is for generative fill category to select what will aspect ratio Be

    const onSelectFieldHandler = (value: string, 
    onCHangeField:(value: string) => void)=> {
        const imageSize = aspectRatioOptions[ value as 
        AspectRatioKey]

        setImage((prevState: any) => ({
            ...prevState,
            aspectRatio: imageSize.aspectRatio,
            width: imageSize.width,
            height: imageSize.height,
        }))

        setnewTransformation(transformationType.config);

        return onCHangeField(value)
    }

    // this is for the object remove category
    const onInputChangeHandler= (fieldName: string, value:
    string, type: string, onCHangeField: (value: string) =>
    void)=>{
        debounce(() => {
            setnewTransformation((prevState: any) => ({
                ...prevState,
                [type]: {
                    ...prevState?.[type],
                    [fieldName=== 'prompt'? 'prompt': "to"]: value
                }
            }))      
        }, 1000)();
        return onCHangeField(value)
    }

    // For credit
    const onTransformHandler= async() => {
        setIsTransforming(true)

        setTransformationConfig(
            deepMergeObjects(newTransformation,
            transformationConfig)
        )
        setnewTransformation(null)

        startTransition(async ()=> {
            await updateCredits(userId, creditFee)
        })
    }

    useEffect(() => {
        if(image && (type === 'restore' || type === 'removeBackground')){
            setnewTransformation(transformationType.config)
        }
    },[ image,transformationType.config, type]) 
      
    // used react hook here
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {creditBalance< Math.abs(creditFee) && <InsufficientCreditsModal />}
                <CustomField
                    control= {form.control}
                    name="title"
                    formLabel='Image Title'
                    className='w-full'
                    render={({field}) => <Input {...field} className='input-field' />}
                />

                {/* function for image fill option */}
                {type === 'fill' && (
                    <CustomField
                        control= {form.control}
                        name= "aspectRatio"
                        formLabel='Aspect Ratio'
                        className='w-full'
                        render= {({ field })=> (
                            <Select
                                onValueChange= {(value) =>
                                onSelectFieldHandler(value,field.onChange)}
                                value={field.value}
                            >
                                <SelectTrigger className="select-field">
                                    <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.keys(aspectRatioOptions).map
                                    ((key) => (
                                        <SelectItem key= {key} value = {key}
                                        className='select-item'>
                                            {aspectRatioOptions[key as 
                                            AspectRatioKey].label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                        )}
                    />
                )}


                {/* function for object remove */}
                {(type === 'remove' || type === "recolor") && (
                    <div className='prompt-field'>
                        <CustomField 
                            control={form.control}
                            name='prompt'
                            formLabel={
                                type === 'remove' ? 'Object to remove':
                                'Object to recolor'
                            }
                            className='w-full'
                            render= {({field}) => (
                                <Input 
                                    value= {field.value}
                                    className='input-field'
                                    onChange={(e) => onInputChangeHandler(
                                        'prompt',
                                        e.target.value,
                                        type,
                                        field.onChange
                                    )}
                                />

                            )}
                        />

                        { type === 'recolor' && (
                            <CustomField 
                                control= {form.control}
                                name='color'
                                formLabel='Replacement color'
                                className='w-full'
                                render={({field}) =>(
                                    <Input 
                                        value= {field.value}
                                        className='input-field'
                                        onChange={(e) => onInputChangeHandler(
                                            'color',
                                            e.target.value,
                                            'recolor',
                                            field.onChange
                                        )}
                                    />
                                )}
                            />

                        )}
                    </div>
                )}

                <div className='media-uploader-field'>
                    <CustomField 
                        control= {form.control}
                        name= 'publicId'
                        className='flex size-full flex-col'
                        render= {({field}) => (
                            <MediaUploader 
                                onValueChange= {field.onChange}
                                setImage={setImage}
                                publicId= {field.value}
                                image= {image}
                                type= {type}
                            />
                        )}
                    />

                    <TransformedImage 
                        image= {image}
                        type={type}
                        title= {form.getValues().title}
                        isTransforming= {isTransforming}
                        setIsTransforming= {setIsTransforming}
                        transformationConfig = {transformationConfig}
                    />  

                </div>

                {/* function to create button in every page for submit */}
                <div className='flex flex-col gap-4'>
                    <Button 
                        type='button' 
                        className='submit-button capitalize'
                        disabled= {isTransforming || newTransformation=== null}
                        onClick={onTransformHandler}
                    >
                        {isTransforming ? 'Transforming... ': 'Apply Transformation'}
                    </Button>
                    <Button 
                        type='submit' 
                        className='submit-button capitalize'
                        disabled= {isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...': 'Save Image'}
                    </Button>
                </div>
                
            </form>
        </Form>
    )
}
export default TransformationForm