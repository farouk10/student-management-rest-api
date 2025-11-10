//models/etudiant.js
import mongoose from "mongoose";
const etudiantSchema = new mongoose.Schema(

    {
        id:{ type: Number, required: true, unique: true},
        nom:{ type:String,required: true},
        prenom:{type:String,required: true},
        email:{type:String,required: true, unique: true},
        matiere:{type:[String], default: []},
        photo: { type: String, default: null }   // ✅ Add this line


    },
    {timestamps: true}
);

const Etudiant = mongoose.model("Etudiant",etudiantSchema);
export default Etudiant;