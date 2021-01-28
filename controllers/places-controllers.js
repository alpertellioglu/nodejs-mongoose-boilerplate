const HttpError = require("../models/http-error");
const { uuid } = require("uuidv4");
const { validationResult } = require("express-validator");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");
const mongoose = require("mongoose");

//GET PLACE
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a place",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      "Could not find a place for the provided id",
      404
    );
    return next(error);
  }
  res.json({ place: place.toObject({ getters: true }) }); //getters adds an id to the object
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  // let places;
  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    const error = new HttpError(
      "Fetching places failed, please try again later",
      500
    );
    return next(error);
  }

  //if(!places || places.length === 0) {
  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    const error = new HttpError(
      "Could not find a place for the provided id",
      404
    );
    return next(error);
  }

  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ), //to get id field in json response
  });
};

//CREATING PLACE
const createPlace = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);

    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const { title, description, address, creator } = req.body;

  let coordinates;

  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/c/c7/Empire_State_Building_from_the_Top_of_the_Rock.jpg",
    creator,
  });

  let user;

  try {
    user = await User.findById(creator);
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 404);
    return next(error);
  }

  console.log(user);

  try {
    //here we want to create the place and update the user's place field
    //if one of them is failed we want to abort all and we want to redo all the changes
    //to achieve this, we need to use session

    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess }); //save the place
    user.places.push(createdPlace);
    await user.save({ session: sess }); // save the user
    await sess.commitTransaction(); //now the all changes will be commited to database
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

///UPDATING PLACE
const updatePlace = async (req, res, next) => {
  const { title, description } = req.body;
  const placeId = req.params.pid;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);

    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not update place.",
      500
    );
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not update place",
      500
    );
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

//DELETING PLACE
const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    //if the relation between user and place schema allows us to use populate
    // ref attribute in the schema shows there is a relation
    // with populate we can access another collection when something is deleted
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place(1)",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Could not find place for this id", 404);
    return next(error);
  }

  try {
    /////use session for relation (user - place)
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place); // thanks to populate this line works
    await place.creator.save({ session: sess }); // thanks to populate this line works
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place",
      500
    );
    return next(error);
  }

  res.status(200).json({ message: "Deleted place" });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
