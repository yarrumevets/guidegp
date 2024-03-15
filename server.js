const express = require("express");

const { Polly, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const awsCreds = require("./awsApiCreds.json");

const app = express();
const port = process.env.PORT || 4111;

// Load config files
const openaiApiCreds = require("./openaiApiCreds.json");
const gptConfig = {
  systemRoles: {
    general:
      "Unless otherwise specified, you are a concierge and guide helping drivers plan for and reach their destinations, " +
      "your response will be converted to audio, so everything should be in natural speaking style, and therefore, don't give any answers in list form or any other non-spoken form. " +
      "Keep responses very short when not providing the JSON response.",
    initial:
      "The user's question should be to find a place of interest or business for the purpose of going there. " +
      "If the prompt doesn't contain or at least hint at seeking a specific POI or business, then respond letting the user know that they should only use this app for this purpose. " +
      `If the promp does contain an inquiry about a POI, then respond in ONLY this format: {"doSearch": true, "type": <type>, "keyword": <keyword>} and include no other characters. ` +
      "This JS object response will negate the previous comment I made about replying in natural speaking style, and that is OK in this case as this particular response will be handled by a JavaScript app. " +
      "You will replace <type> and <keyword> with string literals, including double quotes, making your response a true javascript object. " +
      "the <type> should be, verbatim, on of the following strings that best fits the user's query: " +
      "'accounting','airport','amusement_park','aquarium','art_gallery','atm','bakery','bank','bar','beauty_salon','bicycle_store','book_store','bowling_alley','bus_station','cafe','campground'," +
      "'car_dealer','car_rental','car_repair','car_wash','casino','cemetery','church','city_hall','clothing_store','convenience_store','courthouse','dentist','department_store','doctor','drugstore'," +
      "'electrician','electronics_store','embassy','fire_station','florist','funeral_home','furniture_store','gas_station','gym','hair_care','hardware_store','hindu_temple','home_goods_store'," +
      "'hospital','insurance_agency','jewelry_store','laundry','lawyer','library','light_rail_station','liquor_store','local_government_office','locksmith','lodging','meal_delivery','meal_takeaway'," +
      "'mosque','movie_rental','movie_theater','moving_company','museum','night_club','painter','park','parking','pet_store','pharmacy','physiotherapist','plumber','police','post_office','primary_school'," +
      "'real_estate_agency','restaurant','roofing_contractor','rv_park','school','secondary_school','shoe_store','shopping_mall','spa','stadium','storage','store','subway_station','supermarket'," +
      "'synagogue','taxi_stand','tourist_attraction','train_station','transit_station','travel_agency','university','veterinary_care', and 'zoo'," +
      " and also encased in double-quotes. " +
      "The <keyword> replacement can be an empty string, but should be any single-word modifier to the type that best suits the user's query." +
      `Typical queries could include things like "Take me to a Chinese bakery", "I really wanna see a movie" which would mean they want directions to a movie theatre, or "I'm feeling lucky. I want to gamble" which you could assume means they want to go to a casino.` +
      "It's important to make the effort towards extracting a destination/POI/business/park/etc from the user's request over dismissing it as an invalid prompt.",
  },
};

gptConfig.systemRole +=
  "My current location is 3030 Spruce St, Vancouver, BC V6H 2R7, Canada";

const googleMapsApiKey = require("./googleMapsApi.json").googleMapsApiKey;

// Middleware
app.use(express.static("public"));
app.use(express.json());

// Route / : Serve public folder
app.get("/", (req, res) => {
  res.sendFile("public/index.html", { root: __dirname });
});

const chatGptPrompt = async (message) => {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", `Bearer ${openaiApiCreds.openaiApiKey}`);

  const raw = JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: gptConfig.systemRoles.general + gptConfig.systemRoles.initial,
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0.7,
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };

  const responseMessage = await fetch(
    "https://api.openai.com/v1/chat/completions",
    requestOptions
  )
    .then((response) => response.text())
    .then((result) => {
      jsonResult = JSON.parse(result);
      if (jsonResult && jsonResult.choices && jsonResult.choices[0]) {
        const responseMessage = jsonResult.choices[0].message.content;
        return responseMessage;
      } else {
        return ""; // !!
      }
    })
    .catch((error) => console.log("error", error));

  return responseMessage;
};

// Route /api/send : Forward the user's message on to Openai GPT.
app.post("/api/send", async (req, res) => {
  const responseMessage = await chatGptPrompt(req.body.message);

  // check message for type:

  try {
    console.log("JPD: ", JSON.parse(responseMessage));
  } catch (error) {
    console.log("err: ", error);
  }

  try {
    const jsonResponse = JSON.parse(responseMessage); // Attempt to parse as JSON
    const parsedData = {
      response: "Ok, let me see what I can find for you.",
      type: jsonResponse.type,
      keyword: jsonResponse.keyword,
    }; // Apply custom parsing
    res.json(parsedData);
  } catch (error) {
    res.send({ response: responseMessage });
  }
});

//--- locations stuff ---//

app.post("/location", async (req, res) => {
  const { latitude, longitude } = req.body;
  // longitude = "49.28354858522753";
  // latitude = "-123.12036421164301";

  console.log("lon: ", longitude, ", lat: ", latitude);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapsApiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    // console.log("DATA: ", data);
    const address = data.results[0]?.formatted_address; // Get the formatted address
    console.log("address: ", address); // Log it to the server console
    res.json({ address }); // Send it back to the client
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// FIND PLACE
app.post("/find", async (req, res) => {
  const { latitude, longitude, type, keyword } = req.body; // Assuming latitude and longitude are passed in the request body

  // Places types:
  // https://developers.google.com/maps/documentation/places/web-service/place-types?_gl=1*uglbxn*_up*MQ..*_ga*NjQ5NjA4MTQzLjE3MTAwNTQxMjI.*_ga_NRWSTWS78N*MTcxMDA1NDEyMS4xLjAuMTcxMDA1NDE2Mi4wLjAuMA..
  // REST Resource: places
  // https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places?_gl=1*ocycbe*_up*MQ..*_ga*NjQ5NjA4MTQzLjE3MTAwNTQxMjI.*_ga_NRWSTWS78N*MTcxMDA1NDEyMS4xLjAuMTcxMDA1NDE2Mi4wLjAuMA..#resource:-place

  const googleMapsPlacesURL =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json?" +
    `location=${latitude},${longitude}` +
    "&rankby=distance" +
    `&keyword=${keyword}` +
    // `&radius=1000` + // Only rankby or radius allowed at one time! radius=#meters
    `&type=${type}&key=${googleMapsApiKey}`;

  try {
    const response = await fetch(googleMapsPlacesURL);
    const data = await response.json(); // Parse the JSON from the response
    console.log("data: ", data);
    res.json(data); // Send the parsed data back to the client
  } catch (error) {
    console.error(error);
    res.status(500).send("Error querying Google Places Find");
  }
});

// GET DIRECTIONS
app.post("/getdirections", async (req, res) => {
  const { startLat, startLng, destLat, destLng } = req.body;

  console.log("getting directions.......");

  const googleMapsDirectionsUrl =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${startLat},${startLng}` +
    `&destination=${destLat},${destLng}` +
    `&key=${googleMapsApiKey}`;

  try {
    const response = await fetch(googleMapsDirectionsUrl);
    const data = await response.json(); // Parse the JSON from the response
    console.log("data: ", data);
    res.json(data); // Send the parsed data back to the client
  } catch (error) {
    console.error(error);
    res.status(500).send("Error querying Google Directions");
  }
});

// get google maps api key wink wink! <---------------- FIX ME.
app.post("/test", async (req, res) => {
  const { bar } = req.body;
  console.log("bar: ", bar);
  if (bar == "bazooka") {
    console.log("OK!");
    res.json({ key: googleMapsApiKey });
  } else res.send("AIzaSyCf-2G9D8ZJk27A8S2ZLX5vg8Jqih7ZAbc"); // super fake api key.
});

// ---------- AWS STUFF --------------//

// Configure AWS
const polyConfig = {
  region: "us-east-1", // Specify the AWS Region
  credentials: {
    accessKeyId: awsCreds.polyUser.accessKey, // process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: awsCreds.polyUser.secretAccessKey, // process.env.AWS_SECRET_ACCESS_KEY,
  },
};
console.log("POLYCONFIG: ", polyConfig);
const polly = new Polly(polyConfig);

app.post("/speak", async (req, res) => {
  const { message, name } = req.body; // Assuming latitude and longitude are passed in the request body

  const voiceName = name || "Joey";

  console.log("name: ", voiceName);

  const params = {
    OutputFormat: "mp3",
    Text: `<speak><prosody pitch="low">${message}</prosody></speak>`,
    VoiceId: voiceName, // "Joanna",
    TextType: "ssml",
  };

  const command = new SynthesizeSpeechCommand(params);

  try {
    const { AudioStream } = await polly.send(command);
    res.setHeader("Content-Type", "audio/mp3");
    // If AudioStream is a readable stream, pipe it directly
    if (AudioStream instanceof require("stream").Readable) {
      AudioStream.pipe(res);
    } else {
      // If AudioStream is a Buffer or Uint8Array, write it directly
      res.write(AudioStream);
      res.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating speech");
  }
});

// <><><><><><><><><><><><><><><><><><><><> START SERVER <><><><><><><><><><><><><><><><><><><><><><><><><><> //

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
