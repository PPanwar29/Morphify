import { globalAgent } from "http";
import mongoose, { Mongoose } from "mongoose";
import { cache } from "react";

const MONGODB_URL= process.env.MONGODB_URL;

interface MongooseConnection {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;

}

let cached: MongooseConnection = (global as any).mongoose

if(!cached) {
    cached= (global as any).mongoose = { 
        conn: null, promise: null
    }
}

// Trying To make function for case when MONGODB_URL is found and not found as nextjs is serverless
export const connectToDatabase = async () => {
    if(cached.conn) return cached.conn;

    if(!MONGODB_URL) throw new Error('Missing MONGODB_URL');

// If connection not found try to make new conn

    cached.promise= 
        cached.promise || mongoose.connect(
        MONGODB_URL, { dbName: 'imaginify', bufferCommands: false})

    cached.conn= await cached.promise;
    return cached.conn;
}