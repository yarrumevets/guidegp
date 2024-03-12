const sendButton = document.getElementById("sendbutton");
const inputField = document.getElementById("chatinput");
const chatLog = document.getElementById("chatlog");

const createChatLog = (username, message) => {
  const newLog = document.createElement("p");
  const logName = document.createElement("span");
  const logMessage = document.createElement("span");
  const msgCost = document.createElement("span");
  newLog.classList.add("log");
  logName.classList.add("logname");
  logMessage.classList.add("logmessage");
  msgCost.classList.add("msgcost");
  logName.innerHTML = username;
  logMessage.innerHTML = message;
  newLog.append(msgCost);
  newLog.append(logName);
  newLog.append(logMessage);
  chatLog.append(newLog);
  return msgCost;
};

// const calcCost = (tokens, type) => {
//   const costs = {
//     prompt: 0.0000015, // 0.0015 / 1000,
//     completion: 0.000002, // 0.002 / 1000,
//   };
//   return tokens * costs[type];
// };

// ---- GET THE API KEY FROM BACKEND ---
const googleApiKeyMsgData = {
  bar: "bazooka",
};
const googleApiKeyResponse = await fetch("./test", {
  // @todo update this ./test endpointhere and on the BE
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(googleApiKeyMsgData),
}).catch((err) => console.error("Oh nurr! Error getting api key: ", err));
const googleApiKeyJson = await googleApiKeyResponse.json();
const googleApiKey = googleApiKeyJson.key;
console.log("API KEY: ", googleApiKey);
// --------------- end of google api key --------

async function sendMessage(message) {
  const myMsgCost = createChatLog("You", message);
  const messageData = {
    message,
  };
  const response = await fetch("./api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageData),
  }).catch((err) => console.error("Error: ", err));
  const jsonResponse = await response.json();
  const chatGPTMsgCost = createChatLog("Ai", jsonResponse.response);

  speakBack(jsonResponse.response);

  // const promptCost = calcCost(jsonResponse.usage.prompt_tokens, "prompt");
  // const completionCost = calcCost(
  //   jsonResponse.usage.completion_tokens,
  //   "completion"
  // );
  // myMsgCost.innerHTML = `$${promptCost.toFixed(7)}`;
  // chatGPTMsgCost.innerHTML = `$${completionCost.toFixed(7)}`;
}

const doSend = (prompt) => {
  const message = prompt || inputField.value;
  if (!message) return;
  inputField.value = "";
  inputField.focus();
  sendMessage(message);
};

inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    doSend();
  }
});

sendButton.onclick = () => {
  doSend();
};

// ----------------------------------------- VOICE STUFF ----------------

const startListeningButton = document.getElementById("startlistening");

startListeningButton.addEventListener("click", () => {
  console.log("clicked!");

  const recognition = new webkitSpeechRecognition(); // or SpeechRecognition for non-webkit browsers
  recognition.lang = "en-US";
  recognition.start();

  recognition.onresult = function (event) {
    const text = event.results[0][0].transcript;
    document.getElementById("speaktext").innerText = text; // Display the converted text
    // speakBack("This is a hardcoded response. You said: " + text);

    doSend(text);
    const myMsgCost = createChatLog("You", message);
    console.log("spoken msg cost: ", myMsgCost);
  };

  recognition.onerror = function (event) {
    console.error("Speech recognition error", event.error);
  };
});

function speakBack(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
}

// --------------------[ GEO LOCATION ]-------------------------

document.getElementById("getLocation").addEventListener("click", () => {
  document.getElementById("mylocationtext").innerHTML = ". . . fetching . . .";
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      document.getElementById("startlat").value = latitude;
      document.getElementById("startlng").value = longitude;

      // Send this to the backend
      const response = await fetch("/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      const data = await response.json();

      document.getElementById("mylocationtext").innerHTML = data.address;
    });
  } else {
    console.log("Geolocation is not supported by this browser.");
  }
});

// find something
document.getElementById("findbutton").addEventListener("click", () => {
  if ("geolocation" in navigator) {
    const type = document.getElementById("findtype").value;
    const keyword = document.getElementById("findkeyword").value;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      // Send this to the backend
      const response = await fetch("/find", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latitude, longitude, type, keyword }),
      });

      const data = await response.json();
      console.log(data); // Log the reverse-geocoded address

      const topResult = data.results[0];

      document.getElementById("findresult").innerHTML = topResult.name;
      document.getElementById("destlat").value =
        topResult.geometry.location.lat;
      document.getElementById("destlng").value =
        topResult.geometry.location.lng;
    });
  } else {
    console.log("Geolocation is not supported by this browser.(find bakeries)");
  }
});

// get directions
// find something
document.getElementById("getdirections").addEventListener("click", async () => {
  console.log("...get directions...");

  const directionsElement = document.getElementById("directionsElement");

  directionsElement.innerHTML = ". . . fetching . . .";

  const [startLat, startLng, destLat, destLng] = [
    document.getElementById("startlat").value,
    document.getElementById("startlng").value,
    document.getElementById("destlat").value,
    document.getElementById("destlng").value,
  ];

  if (startLat && startLng && destLat && destLng) {
    // Send this to the backend
    const response = await fetch("/getdirections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startLat, startLng, destLat, destLng }),
    });

    const data = await response.json();
    const steps = data.routes[0].legs[0].steps;

    console.log("steps: ", steps);

    steps.forEach((step, i) => {
      const stepElement = document.createElement("p");
      stepElement.innerHTML = step.html_instructions;
      directionsElement.appendChild(stepElement);
    });
  }
});

//--------------- MAP STUFF -------------------

// const getUserLocation = async () => {
//   return navigator.geolocation.getCurrentPosition(async (position) => {
//     return position.coords;
//   });
// };

let map, userMarker, pathPolyline;
let currentStepIndex = 0;

let steps = [
  {
    distance: {
      text: "28 m",
      value: 28,
    },
    duration: {
      text: "1 min",
      value: 7,
    },
    end_location: {
      lat: 49.2583035,
      lng: -123.1292333,
    },
    html_instructions: "Head <b>west</b> toward <b>Spruce St</b>",
    polyline: {
      points: "iwskHhronVAjA",
    },
    start_location: {
      lat: 49.2582938,
      lng: -123.1288497,
    },
    travel_mode: "DRIVING",
  },
  {
    distance: {
      text: "55 m",
      value: 55,
    },
    duration: {
      text: "1 min",
      value: 16,
    },
    end_location: {
      lat: 49.2578065,
      lng: -123.1292804,
    },
    html_instructions: "Turn <b>left</b> onto <b>Spruce St</b>",
    maneuver: "turn-left",
    polyline: {
      points: "kwskHttonV`BH",
    },
    start_location: {
      lat: 49.2583035,
      lng: -123.1292333,
    },
    travel_mode: "DRIVING",
  },
  {
    distance: {
      text: "0.1 km",
      value: 128,
    },
    duration: {
      text: "1 min",
      value: 32,
    },
    end_location: {
      lat: 49.257814,
      lng: -123.1275184,
    },
    html_instructions:
      'Turn <b>left</b> onto <b>W 15th Ave</b><div style="font-size:0.9em">Destination will be on the right</div>',
    maneuver: "turn-left",
    polyline: {
      points: "itskH~tonV?mBAuE?O@I?A",
    },
    start_location: {
      lat: 49.2578065,
      lng: -123.1292804,
    },
    travel_mode: "DRIVING",
  },
];

const userLocation = { lat: 49.2583077, lng: -123.1288489 }; // Placeholder for the initial user location

window.initMap = () => {
  map = new google.maps.Map(document.getElementById("map"), {
    center: userLocation,
    zoom: 18,
  });

  // Marker for user's location
  userMarker = new google.maps.Marker({
    position: userLocation,
    map: map,
    title: "Your Location",
  });

  // Initial path polyline setup
  pathPolyline = new google.maps.Polyline({
    path: [userLocation, steps[currentStepIndex].end_location],
    geodesic: true,
    strokeColor: "#FF0000",
    strokeOpacity: 1.0,
    strokeWeight: 5,
  });
  pathPolyline.setMap(map);

  // Display the first set of instructions
  updateInstructions();
};

function updateUserLocation() {
  console.log(
    "Update user location and see if we need to move to the next step..."
  );

  navigator.geolocation.watchPosition(
    function (position) {
      const newPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      userMarker.setPosition(newPos);

      // Update the polyline to point from the new position to the next step's end location
      pathPolyline.setPath([newPos, steps[currentStepIndex].end_location]);

      const distanceToCheckpoint =
        google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(newPos),
          new google.maps.LatLng(steps[currentStepIndex].end_location)
        );

      console.log("distance to next checkpoint: ", distanceToCheckpoint);

      // When close enough to the end of the current step, advance to the next step
      if (distanceToCheckpoint < 5) {
        // meters
        currentStepIndex++;
        if (currentStepIndex < steps.length) {
          // Check if there are more steps
          pathPolyline.setPath([newPos, steps[currentStepIndex].end_location]);
          updateInstructions();
        }
      }
    },
    (err) => console.warn("ERROR OH NOES! (" + err.code + "): " + err.message),
    {
      enableHighAccuracy: true,
      timeout: 5000, // 10 seconds
      maximumAge: 0,
    }
  );
}

// Update the text for the curent step.
function updateInstructions() {
  const instructionsElement = document.getElementById("instructions");
  if (steps[currentStepIndex]) {
    instructionsElement.innerHTML = steps[currentStepIndex].html_instructions;
  }
}

// Load Google Maps
function loadGoogleMapsAPI() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap&libraries=geometry`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}
loadGoogleMapsAPI();

updateUserLocation(); // recursively calls forever.
