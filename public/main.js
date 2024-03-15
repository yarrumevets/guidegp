const sendButton = document.getElementById("sendbutton");
const inputField = document.getElementById("chatinput");
const chatLog = document.getElementById("chatlog");

const createChatLog = (username, message) => {
  const newLog = document.createElement("p");
  const logName = document.createElement("span");
  const logMessage = document.createElement("span");
  newLog.classList.add("log");
  logName.classList.add("logname");
  logMessage.classList.add("logmessage");
  logName.innerHTML = username;
  logMessage.innerHTML = message;
  newLog.append(logName);
  newLog.append(logMessage);
  chatLog.append(newLog);
};

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
// --------------- end of google api key --------

async function sendMessage(message) {
  createChatLog("You", message);
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
  createChatLog("GuideGPT", jsonResponse.response);

  speakBack(jsonResponse.response);

  if (jsonResponse.type) {
    const type = (document.getElementById("findtype").value =
      jsonResponse.type);
    let keyword;
    if (jsonResponse.keyword) {
      keyword = document.getElementById("findkeyword").value =
        jsonResponse.keyword;
    }

    doFind(type, keyword);
  }
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

document.getElementById("speakbutton").addEventListener("click", () => {
  console.log("clicked!");
  const recognition = new webkitSpeechRecognition(); // or SpeechRecognition for non-webkit browsers
  recognition.lang = "en-US";
  recognition.start();
  recognition.onresult = function (event) {
    const text = event.results[0][0].transcript;
    doSend(text);
  };
  recognition.onerror = function (event) {
    console.error("Speech recognition error", event.error);
  };
});

const speakBack = (text) => {
  // Browser's built-in Speech:
  // const utterance = new SpeechSynthesisUtterance(text);
  // speechSynthesis.speak(utterance);
  speakPolly(text, document.getElementById("pollyVoice").value);
};

// --------------------[ GEO LOCATION ]-------------------------

const enableHighAccuracy = false; // false speeds up tracking but less accurate.

let userInitialPosition = {};

// Just get my current location.
// @TODO: Refactor to combine with the find button and
document.getElementById("getLocation").addEventListener("click", () => {
  getMyCurrentLocation();
});

const getMyCurrentLocation = () => {
  document.getElementById("mylocationtext").innerHTML = ". . . fetching . . .";
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // apply the user start coords that are used by the maps api.
        userInitialPosition.lat = position.coords.latitude;
        userInitialPosition.lng = position.coords.longitude;

        document.getElementById("startlat").value = latitude;
        document.getElementById("startlng").value = longitude;
        // Send this to the backend
        const response = await fetch("./location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ latitude, longitude }),
        });
        const data = await response.json();
        document.getElementById("mylocationtext").innerHTML = data.address;
      },
      (error) => {
        console.error("geolocation error: " + error);
      },
      {
        enableHighAccuracy: enableHighAccuracy,
      }
    );
  } else {
    console.log("Geolocation is not supported by this browser.");
  }
};

// Find something based on my current location.
document.getElementById("findbutton").addEventListener("click", () => {
  doFind();
});

const doFind = (t, k) => {
  if ("geolocation" in navigator) {
    const type = t || document.getElementById("findtype").value;
    const keyword = k || document.getElementById("findkeyword").value;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Send this to the backend
        const response = await fetch("./find", {
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

        // DO THE NEXT STEP.... @todo: call this from the same parent ?
        console.log("getting directions (steps)...");
        await getDirections();
        console.log("setting course...");
        doMapStuff();
      },
      (error) => {
        console.error("geolocation error: " + error);
      },
      {
        enableHighAccuracy: enableHighAccuracy,
      }
    );
  } else {
    console.log("Geolocation is not supported by this browser.(find bakeries)");
  }
};

//--------------- MAP STUFF -------------------

let map;
let userMarker;
let pathPolyline;
let currentStepIndex = 0;
let steps;

const endpointAccuracyMeters = 5; // How close to the endpoint you must be to trigger the next step.

// Get directions.
document.getElementById("getdirections").addEventListener("click", async () => {
  getDirections();
});

// This function is just for skipping steps to read them out.
document.getElementById("nextdirection").addEventListener("click", async () => {
  currentStepIndex++;
  speakStep(steps, currentStepIndex);
});

const getDirections = async () => {
  const directionsElement = document.getElementById("directionsElement");
  directionsElement.innerHTML = ". . . fetching directions . . .";
  const [startLat, startLng, destLat, destLng] = [
    document.getElementById("startlat").value,
    document.getElementById("startlng").value,
    document.getElementById("destlat").value,
    document.getElementById("destlng").value,
  ];
  if (startLat && startLng && destLat && destLng) {
    const response = await fetch("./getdirections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startLat, startLng, destLat, destLng }),
    });
    const data = await response.json();
    steps = data.routes[0].legs[0].steps;

    // speak the first step right away.
    speakStep(steps, 0);

    // Display all steps:
    console.log("steps: ", steps);
    let stepsText = "";
    steps.forEach((step) => {
      stepsText += step.html_instructions + "<br/>";
    });
    directionsElement.innerHTML = `${steps.length} steps. <br/> ${stepsText}`;
  }
};

window.initMap = () => {
  console.log("<><><><><> INIT MAP!!!");
  map = new google.maps.Map(document.getElementById("map"), {
    center: userInitialPosition,
    zoom: 18,
  });

  // Marker for user's location
  userMarker = new google.maps.Marker({
    position: userInitialPosition,
    map: map,
    title: "Your Location",
  });

  // Initial path polyline setup
  pathPolyline = new google.maps.Polyline({
    path: [userInitialPosition, steps[currentStepIndex].end_location],
    geodesic: true,
    strokeColor: "#00FF00",
    strokeOpacity: 0.9,
    strokeWeight: 5,
  });
  pathPolyline.setMap(map);

  // Display the first set of instructions
  updateInstructions();
};

// Util functions for speaking the steps
function removeHTMLTagsUsingDOMParser(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  return doc.body.textContent || "";
}
const speakStep = (theSteps, index) => {
  console.log("step at index: ", theSteps[index]);
  // Remove the HTML tags and then speak the step out loud.
  const instructions = removeHTMLTagsUsingDOMParser(
    theSteps[index].html_instructions
  );
  const spokenStepIndex = index + 1;
  const formattedStepText = "Step " + spokenStepIndex + ". " + instructions;
  createChatLog("GuideGPT", formattedStepText);
  speakBack(formattedStepText);
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

      console.log("usermarker: ", userMarker);

      userMarker.setPosition(newPos);

      console.log(
        "newPost: ",
        newPos,
        "steps[..].end_location: ",
        steps[currentStepIndex].end_location,
        " pathPolyline: ",
        pathPolyline
      );

      // Update the polyline to point from the new position to the next step's end location
      pathPolyline.setPath([newPos, steps[currentStepIndex].end_location]);

      const distanceToCheckpoint =
        google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(newPos),
          new google.maps.LatLng(steps[currentStepIndex].end_location)
        );

      console.log("distance to next checkpoint: ", distanceToCheckpoint);

      // When close enough to the end of the current step, advance to the next step
      if (distanceToCheckpoint < endpointAccuracyMeters) {
        speakStep(steps, currentStepIndex);

        // meters
        currentStepIndex++;
        if (currentStepIndex < steps.length) {
          // Check if there are more steps
          pathPolyline.setPath([newPos, steps[currentStepIndex].end_location]);
          updateInstructions();
        }
      }
    },
    (err) => console.warn("ERROR: (" + err.code + "): " + err.message),
    {
      enableHighAccuracy: true,
      timeout: 5000, // the amound of time that should pass when triggering a timout.
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

// Button click to start maps stuff.
const updateUserLocationButton = document.getElementById("updateUserLocation");
updateUserLocationButton.addEventListener("click", async () => {
  doMapStuff();
});

const doMapStuff = () => {
  console.log("OK LETS MAP IT!");
  updateUserLocationButton.setAttribute("disabled", "disabled");
  loadGoogleMapsAPI();
  updateUserLocation(); // recursively calls forever.
};

getMyCurrentLocation();

// ------------------ POLY Speech -------------------- //

const defaultPolyVoice = "Joey";

let isSpeaking = false;
const speakQueue = [];

const speakPolly = (message, name) => {
  // Add to queue if there is speaking in progress.
  if (isSpeaking) {
    speakQueue.push({
      message,
      name,
    });
    return;
  }
  isSpeaking = true;

  const voiceName = name || defaultPolyVoice;
  const messageConfig = {
    message: message,
    name: voiceName,
  };
  fetch("./speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageConfig),
  })
    .then((response) => response.blob())
    .then((blob) => {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      // Manage a speaking queue
      audio.onended = () => {
        isSpeaking = false;
        if (speakQueue.length) {
          speakPolly(...Object.values(speakQueue[0]));
          speakQueue.shift();
        }
      };

      // Play the audio file.
      audio.play();
    })
    .catch((error) => console.error("Error:", error));
};

// Manual test of the poly service
document.getElementById("pollyButton").addEventListener("click", function () {
  const voiceName = document.getElementById("pollyVoice").value || "Joey";
  speakPolly("Hi there, my name is " + voiceName, voiceName);
});

document
  .getElementById("advancedtoggle")
  .addEventListener("click", function () {
    document.getElementById("advanced").toggleAttribute("hidden");
  });
