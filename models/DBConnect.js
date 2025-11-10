//models/DBConnect.js

import mongoose from "mongoose";

export async function DBconnect(){
    try{
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connecte");

    }catch(err){
        console.error("Erreur MongoDB", err);
    }
}