const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // when you say unique: true, indexes the email => increases the speed of the queries
  password: { type: String, required: true, minlength: 6 },
  image: { type: String, required: true },
  places: [{ type: mongoose.Types.ObjectId, required: true, ref: "Place" }], // this is an array bcz a user can have multiple places
});

userSchema.plugin(uniqueValidator); //be sure that emails are unique for each user

module.exports = mongoose.model("User", userSchema);
