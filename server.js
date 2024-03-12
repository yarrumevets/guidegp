const express = require("express");
const app = express();
const port = process.env.PORT || 4111;

// Load config files
const openaiApiCreds = require("./openaiApiCreds.json");
const gptConfig = {
  systemRole:
    "You are a concierge and guide helping drivers plan for and reach their destinations." +
    "Your response will be converted to audio, so everything should be in natural speaking style." +
    "Keep responses short.",
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
        content: gptConfig.systemRole,
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
  res.send({ response: responseMessage });
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
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
