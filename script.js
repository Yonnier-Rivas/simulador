// Constantes físicas
const GRAVITY = 9.81; // m/s^2
const FRICTION_COEFFICIENT = 0.7; // Coeficiente de fricción típico para asfalto seco

// Elementos del DOM
const zoneSelect = document.getElementById("zone");
const speedInput = document.getElementById("speed");
const distanceInput = document.getElementById("distance");
const simulateBtn = document.getElementById("simulate");
const resetBtn = document.getElementById("reset");
const brakeBtn = document.getElementById("brake");
const simulationContainer = document.getElementById("simulation-container");
const car = document.getElementById("car");
const camera = document.getElementById("camera");
const flash = document.getElementById("flash");
const resultsContainer = document.getElementById("results-container");
const housesContainer = document.getElementById("houses-container");

// Variables de simulación
let animationId;
let startTime;
let currentPosition = 0;
let currentSpeed = 0;
let isBraking = false;
let simulationData = [];

// Gráficas
let positionTimeChart;
let velocityTimeChart;

// Inicialización
document.addEventListener("DOMContentLoaded", initializeSimulation);

function initializeSimulation() {
  createHouses();
  initializeCharts();
  attachEventListeners();
}

function createHouses() {
  housesContainer.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const house = document.createElement("div");
    house.className = "house";
    housesContainer.appendChild(house);
  }
}

function initializeCharts() {
  const chartOptions = {
    responsive: true,
    animation: { duration: 0 },
    scales: {
      x: { title: { display: true, text: "Tiempo (s)" } },
      y: { title: { display: true, text: "Valor" } },
    },
    elements: { line: { tension: 0.4 } },
  };

  positionTimeChart = new Chart("position-time-graph", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Posición (m)",
          borderColor: "rgb(75, 192, 192)",
          data: [],
        },
      ],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          title: { ...chartOptions.scales.y.title, text: "Posición (m)" },
        },
      },
    },
  });

  velocityTimeChart = new Chart("velocity-time-graph", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Velocidad (km/h)",
          borderColor: "rgb(255, 99, 132)",
          data: [],
        },
      ],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          title: { ...chartOptions.scales.y.title, text: "Velocidad (km/h)" },
        },
      },
    },
  });

  // Crear la gráfica de fuerza de fricción
  frictionForceChart = new Chart("friction-force-graph", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Fuerza de Fricción (N)",
          borderColor: "rgb(54, 162, 235)",
          data: [],
        },
      ],
    },
    options: {
      responsive: true,
      animation: { duration: 0 },
      scales: {
        x: { title: { display: true, text: "Tiempo (s)" } },
        y: { title: { display: true, text: "Fuerza (N)" } },
      },
      elements: { line: { tension: 0.4 } },
    },
  });

  // Gráfica de Aceleración vs Tiempo (nueva)
  accelerationTimeChart = new Chart("acceleration-time-graph", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Aceleración (m/s²)",
          borderColor: "rgb(255, 159, 64)",
          data: [],
        },
      ],
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: { title: { text: "Aceleración (m/s²)" } },
      },
    },
  });
}

function attachEventListeners() {
  simulateBtn.addEventListener("click", startSimulation);
  resetBtn.addEventListener("click", resetSimulation);
  brakeBtn.addEventListener("click", applyBrakes);
}

function startSimulation() {
  const initialSpeed = parseFloat(speedInput.value);
  const totalDistance = parseFloat(distanceInput.value);

  // Obtener el valor del clima
  const weather = weatherSelect.value;
  if (weather === "rainy") {
    frictionCoefficient = 0.5; // Reduce por lluvia
  } else if (weather === "snowy") {
    frictionCoefficient = 0.3; // Aún menor por nieve
  } else {
    frictionCoefficient = 0.7; // Valor predeterminado para clima seco
  }

  if (
    isNaN(initialSpeed) ||
    isNaN(totalDistance) ||
    initialSpeed <= 0 ||
    totalDistance <= 0
  ) {
    Swal.fire({
      icon: "error",
      title: "Datos inválidos",
      text: "Por favor, ingrese valores válidos para la velocidad y la distancia.",
    });
    return;
  }

  resetSimulation();
  currentSpeed = initialSpeed;
  startTime = performance.now();
  simulationData = [];
  animationId = requestAnimationFrame(updateSimulation);
  brakeBtn.disabled = false;
}

function updateSimulation(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsedTime = (timestamp - startTime) / 1000; // segundos

  // Obtener el totalDistance y verificar que es válido
  const totalDistance = parseFloat(distanceInput.value);
  if (isNaN(totalDistance) || totalDistance <= 0) {
    console.error("Distancia total inválida.");
    endSimulation();
    return;
  }

  // Actualizar la posición del vehículo en el mapa
  const vehicleMarker = document.getElementById("vehicle-marker");
  if (vehicleMarker) {
    const progressPercentage = (currentPosition / totalDistance) * 100;
    vehicleMarker.style.left = `${Math.min(progressPercentage, 100)}%`;
  } else {
    console.error("Elemento 'vehicle-marker' no encontrado.");
  }

  // Verificar y manejar la animación de las casas
  if (currentSpeed > 0 && !housesContainer.classList.contains("animate")) {
    housesContainer.classList.add("animate");
  } else if (
    currentSpeed <= 0 &&
    housesContainer.classList.contains("animate")
  ) {
    housesContainer.classList.remove("animate");
  }

  // Actualizar el medidor de velocidad en tiempo real
  const speedMeter = document.getElementById("current-speed");
  if (speedMeter) {
    speedMeter.textContent = `${currentSpeed.toFixed(2)} km/h`;
  }

  // Calcular y actualizar la distancia de frenado en tiempo real
  const brakingDistance = calculateBrakingDistance(currentSpeed);
  const brakingDistanceMeter = document.getElementById("braking-distance");
  if (brakingDistanceMeter) {
    brakingDistanceMeter.textContent = `${brakingDistance.toFixed(2)} m`;
  }

  // Calcular la distancia restante hasta la cámara y mostrar aviso si es necesario
  const remainingDistance = totalDistance - currentPosition;
  const brakeAdvice = document.getElementById("brake-advice");
  if (brakeAdvice) {
    if (remainingDistance <= brakingDistance && currentSpeed > 0) {
      brakeAdvice.classList.remove("hidden");
    } else {
      brakeAdvice.classList.add("hidden");
    }
  }

  // Aplicar frenado si se está frenando
  if (isBraking) {
    const deceleration = FRICTION_COEFFICIENT * GRAVITY; // m/s^2
    currentSpeed = Math.max(
      0,
      currentSpeed -
        deceleration *
          (elapsedTime - simulationData[simulationData.length - 1].time)
    );
  }

  // Calcular la fuerza de fricción: F = μ * m * g (asumiendo masa de 1000 kg como ejemplo)
  const mass = 1000; // kg
  const frictionForce = frictionCoefficient * mass * GRAVITY;

  // Actualizar la gráfica de fuerza de fricción
  frictionForceChart.data.labels.push(elapsedTime.toFixed(1));
  frictionForceChart.data.datasets[0].data.push(frictionForce.toFixed(2));
  frictionForceChart.update();

  // Actualizar posición y agregar a simulationData
  currentPosition +=
    (currentSpeed / 3.6) *
    (elapsedTime -
      (simulationData.length
        ? simulationData[simulationData.length - 1].time
        : 0));

  updateVisualSimulation(currentPosition, totalDistance);
  updateCharts(elapsedTime, currentPosition, currentSpeed);
  simulationData.push({
    time: elapsedTime,
    position: currentPosition,
    speed: currentSpeed,
  });

  // Terminar la simulación si se alcanza la distancia total
  if (currentPosition >= totalDistance) {
    endSimulation();
  } else {
    animationId = requestAnimationFrame(updateSimulation);
  }

  // Aplicar sombras dinámicas al vehículo según la velocidad
  if (currentSpeed >= 60) {
    car.classList.add("shadow-dynamic-fast");
    car.classList.remove("shadow-dynamic");
  } else {
    car.classList.add("shadow-dynamic");
    car.classList.remove("shadow-dynamic-fast");
  }

  // Modificar la animación de los árboles según la velocidad
  const treesContainer = document.getElementById("trees-container");
  if (treesContainer) {
    const swaySpeed = Math.max(1, 3 - currentSpeed / 50); // Aumenta la frecuencia con mayor velocidad
    treesContainer.querySelectorAll(".tree").forEach((tree) => {
      tree.style.animationDuration = `${swaySpeed}s`;
    });
  }
}

function updateVisualSimulation(position, totalDistance) {
  const progress = (position / totalDistance) * 100;
  car.style.left = `${Math.min(progress, 95)}%`; // Limitar al 95% para mantener visible

  // Animar las ruedas
  const wheels = car.querySelectorAll(".wheel");
  const wheelRotation = (position * 360) / (2 * Math.PI * 0.3); // Asumiendo radio de rueda de 0.3m
  wheels.forEach((wheel) => {
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
  });

  // Mover las casas
  housesContainer.style.transform = `translateX(-${progress}%)`;

  // Modificar el código en updateVisualSimulation para verificar si el vehículo se está moviendo
  if (currentSpeed > 0) {
    wheels.forEach((wheel) => {
      wheel.style.animationPlayState = "running";
    });
  } else {
    wheels.forEach((wheel) => {
      wheel.style.animationPlayState = "paused";
    });
  }
}

function updateCharts(time, position, speed) {
  const deltaTime = simulationData.length
    ? time - simulationData[simulationData.length - 1].time
    : 0;
  const deltaSpeed = simulationData.length
    ? speed - simulationData[simulationData.length - 1].speed
    : 0;
  const acceleration = deltaTime > 0 ? deltaSpeed / deltaTime : 0; // Calcula la aceleración

  positionTimeChart.data.labels.push(time.toFixed(1));
  positionTimeChart.data.datasets[0].data.push(position.toFixed(2));
  positionTimeChart.update();

  velocityTimeChart.data.labels.push(time.toFixed(1));
  velocityTimeChart.data.datasets[0].data.push(speed.toFixed(2));
  velocityTimeChart.update();

  // Actualizar la gráfica de aceleración  AGREGADO!!
  accelerationTimeChart.data.labels.push(time.toFixed(1));
  accelerationTimeChart.data.datasets[0].data.push(acceleration.toFixed(2));
  accelerationTimeChart.update();
}

const weatherSelect = document.getElementById("weather");
function applyBrakes() {
  isBraking = true;
  brakeBtn.disabled = true;
}

function endSimulation() {
  cancelAnimationFrame(animationId);
  const finalSpeed = currentSpeed;
  const speedLimit = getSpeedLimit();
  const brakingDistance = calculateBrakingDistance(
    parseFloat(speedInput.value)
  );

  displayResults(finalSpeed, speedLimit, brakingDistance);
}

function getSpeedLimit() {
  const limits = { residential: 30, urban: 60, highway: 80 };
  return limits[zoneSelect.value];
}

function calculateBrakingDistance(initialSpeed) {
  // d = v^2 / (2 * μ * g)
  return (initialSpeed * initialSpeed) / (2 * FRICTION_COEFFICIENT * GRAVITY);
}

function displayResults(finalSpeed, speedLimit, brakingDistance) {
  const exceededLimit = finalSpeed > speedLimit;

  if (exceededLimit) {
    camera.classList.add("over-speed-limit");
  } else {
    camera.classList.remove("over-speed-limit");
  }

  const resultHTML = `
  <div class="bg-gray-50 p-4 rounded-lg shadow-lg ${
    exceededLimit ? "border-red-400" : "border-green-400"
  } border-4">
      <div class="flex justify-between items-center">
          <h3 class="text-2xl font-bold ${
            exceededLimit ? "text-red-500" : "text-green-500"
          }">
              ${
                exceededLimit
                  ? "¡Fotomulta Activada!"
                  : "Velocidad dentro del límite"
              }
          </h3>
          <button onclick="toggleDetails('details-container')" class="bg-blue-500 text-white rounded px-3 py-1 text-sm">Detalles</button>
      </div>
      <p><strong>Velocidad final:</strong> ${finalSpeed.toFixed(2)} km/h</p>
      <p><strong>Límite de velocidad:</strong> ${speedLimit} km/h</p>
      <p><strong>Distancia de frenado:</strong> ${brakingDistance.toFixed(
        2
      )} m</p>
      <div id="details-container" class="hidden mt-4 space-y-3">
          <div class="bg-white p-3 rounded-lg shadow-md">
              <h4 class="font-semibold mb-2">Fórmulas Aplicadas</h4>
              <button onclick="toggleSection('mru-details')" class="underline text-blue-500">Movimiento Rectilíneo Uniforme (MRU)</button>
              <div id="mru-details" class="hidden">
                  <p class="mt-2">v = d / t</p>
                  <p>Donde: <br>v = velocidad <br>d = distancia <br>t = tiempo</p>
              </div>
              <button onclick="toggleSection('mrua-details')" class="underline text-blue-500 mt-4">Movimiento Rectilíneo Uniformemente Acelerado (MRUA)</button>
              <div id="mrua-details" class="hidden">
                  <p class="mt-2">v_f^2 = v_i^2 + 2 * a * d</p>
                  <p>Donde: <br>v_f = velocidad final <br>v_i = velocidad inicial <br>a = aceleración <br>d = distancia</p>
              </div>
          </div>
      </div>
  </div>
`;

  resultsContainer.innerHTML = resultHTML;

  // Efecto visual de flash de la cámara
  if (exceededLimit) {
    flash.classList.remove("hidden");
    setTimeout(() => flash.classList.add("hidden"), 200);
  }

  Swal.fire({
    icon: exceededLimit ? "warning" : "success",
    title: exceededLimit ? "¡Fotomulta Activada!" : "Velocidad Adecuada",
    text: exceededLimit
      ? `Has superado el límite de velocidad de ${speedLimit} km/h.`
      : "Has mantenido una velocidad adecuada.",
    footer: `Distancia de frenado recomendada: ${brakingDistance.toFixed(2)} m`,
  });

  // Mostrar consejos de seguridad vial
  const tipsContainer = document.getElementById("tips-container");
  const safetyTipsSection = document.getElementById("safety-tips");
  let tipsHTML;

  if (exceededLimit) {
    tipsHTML = `
           <p>⚠️ Has superado el límite de velocidad. Asegúrate de moderar tu velocidad, especialmente en zonas residenciales y urbanas. </p>
           <p>🔹 Reduce la velocidad gradualmente y anticipa los posibles obstáculos en el camino.</p>
           <p>🔹 Mantén una distancia segura con otros vehículos y evita frenar bruscamente.</p>
       `;
  } else {
    tipsHTML = `
           <p>✅ Has mantenido una velocidad adecuada. Recuerda siempre seguir las señales de tráfico y ajustar tu velocidad a las condiciones de la carretera.</p>
           <p>🔹 Conduce con precaución, especialmente en zonas con límites de velocidad bajos.</p>
           <p>🔹 Mantén la vista en el camino y ajusta tu velocidad en caso de lluvia o nieve.</p>
       `;
  }

  tipsContainer.innerHTML = tipsHTML;
  safetyTipsSection.classList.remove("hidden");

  // Generar y mostrar estadísticas finales
  const statsContainer = document.getElementById("stats-container");
  const finalStatsSection = document.getElementById("final-stats");
 

  const maxSpeed = Math.max(...simulationData.map((data) => data.speed));
  const totalDistanceCovered =
    simulationData[simulationData.length - 1].position;
  const totalTime = simulationData[simulationData.length - 1].time;

  const statsHTML = `
        <p><strong>Velocidad Máxima Alcanzada:</strong> ${maxSpeed.toFixed(
          2
        )} km/h</p>
        <p><strong>Distancia Total Recorrida:</strong> ${totalDistanceCovered.toFixed(
          2
        )} m</p>
        <p><strong>Tiempo Total de Simulación:</strong> ${totalTime.toFixed(
          2
        )} s</p>
        <p><strong>Fotomultas Generadas:</strong> ${
          exceededLimit ? "Sí" : "No"
        }</p>
    `;

  statsContainer.innerHTML = statsHTML;
  finalStatsSection.classList.remove("hidden");
}

// Función para alternar la visibilidad de los detalles
function toggleDetails(id) {
  const element = document.getElementById(id);
  element.classList.toggle("hidden");
}

// Función para alternar la visibilidad de una sección específica
function toggleSection(id) {
  const section = document.getElementById(id);
  section.classList.toggle("hidden");
}

function displayPhysicalAnalysis(finalSpeed, brakingDistance, mass = 1000) {
  const frictionForce = frictionCoefficient * mass * GRAVITY;
  const initialSpeed = parseFloat(speedInput.value) / 3.6; // Convertir km/h a m/s
  const kineticEnergy = 0.5 * mass * Math.pow(initialSpeed, 2);
  const momentum = mass * initialSpeed;
  const acceleration = Math.pow(initialSpeed, 2) / (2 * brakingDistance);
  const workDone = frictionForce * brakingDistance;
  const averagePower = workDone / (initialSpeed / acceleration); // Suponiendo frenado uniforme

  const analysisHTML = `
  
      <div class="bg-gray-50 p-4 rounded-lg shadow-lg mt-4">
          <div class="flex justify-between items-center">
              <h3 class="text-xl font-bold text-blue-600">Aceleración y Frenado</h3>
              <button onclick="toggleSection('acelacion-frenado')" class="bg-blue-500 text-white rounded px-3 py-1 text-sm">Detalles</button>
          </div>
          <div id="acelacion-frenado" class="hidden mt-2">
           <p class="text-gray-700">
                La <strong>aceleración</strong> se calcula a partir del cambio de velocidad y tiempo: 
                <code>a = Δv / Δt</code>. Durante el frenado, la deceleración se basa en la fuerza de fricción:
                <code>a = F_fric / m</code>.
            </p>
                <p class="text-gray-600">Durante la frenada, la aceleración (o deceleración) depende del coeficiente de fricción, la gravedad, y la velocidad inicial del vehículo.</p>
          </div>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg shadow-lg mt-4">
          <div class="flex justify-between items-center">
              <h3 class="text-xl font-bold text-blue-600">Distancia de Frenado</h3>
              <button onclick="toggleSection('distant-frenado')" class="bg-blue-500 text-white rounded px-3 py-1 text-sm">Detalles</button>
          </div>
          <div id="distant-frenado" class="hidden mt-2">
             <p>La distancia de frenado se calcula con base en la velocidad y el coeficiente de fricción. Esta distancia es crucial para determinar si el vehículo podrá detenerse antes de llegar a la cámara de fotomulta.</p>
                <p><strong>Fórmula de Frenado:</strong> <code>d = v² / (2 * μ * g)</code></p>
          </div>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg shadow-lg">
          <div class="flex justify-between items-center">
              <h3 class="text-xl font-bold text-blue-600">Fuerza de Fricción</h3>
              <button onclick="toggleSection('friction-details')" class="bg-blue-500 text-white rounded px-3 py-1 text-sm">Detalles</button>
          </div>
          <p><strong>Fuerza de fricción aplicada:</strong> ${frictionForce.toFixed(
            2
          )} N</p>
          <div id="friction-details" class="hidden mt-2">
              <p>F = μ * m * g</p>
              <p>F = ${frictionCoefficient.toFixed(
                2
              )} * ${mass} kg * ${GRAVITY} m/s²</p>
              <br>
              <p>Fuerza normal = ${mass} kg * ${GRAVITY} m/s²</p>
              <p>Fuerza normal = ${mass * GRAVITY} N </p>
              <br>
              <p class="text-gray-700">
                La <strong>fuerza de fricción</strong> entre el vehículo y la carretera depende del tipo de superficie y se calcula con la fórmula:
                <code>F_fric = μ * m * g</code>, donde:

            </p>
            <ul class="list-disc pl-5 text-gray-600">
                <li>μ: Coeficiente de fricción</li>
                <li>m: Masa del vehículo (aproximadamente 1000 kg en esta simulación)</li>
                <li>g: Gravedad (9.81 m/s²)</li>
            </ul>
            <br>
            <p>La fuerza de fricción es proporcional a la fuerza normal.</p>
            <p class="text-gray-700 mt-2">En esta simulación, se ajusta según el clima: seco (0.7), lluvioso (0.5), y nevado (0.3).</p>
          </div>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg shadow-lg mt-4">
          <div class="flex justify-between items-center">
              <h3 class="text-xl font-bold text-blue-600">Energía Cinética</h3>
              <button onclick="toggleSection('energy-details')" class="bg-blue-500 text-white rounded px-3 py-1 text-sm">Detalles</button>
          </div>
          <p><strong>Energía cinética inicial:</strong> ${kineticEnergy.toFixed(
            2
          )} J</p>
          <div id="energy-details" class="hidden mt-2">
              <p>KE = 1/2 * m * v²</p>
              <p>KE = 1/2 * ${mass} kg * (${initialSpeed.toFixed(2)} m/s)²</p>
          </div>
      </div>
  `;

  document.getElementById("analysis-container").innerHTML = analysisHTML;
  document.getElementById("physical-analysis").classList.remove("hidden");
}

function endSimulation() {
  cancelAnimationFrame(animationId);
  const finalSpeed = currentSpeed;
  const speedLimit = getSpeedLimit();
  const brakingDistance = calculateBrakingDistance(
    parseFloat(speedInput.value)
  );
  displayResults(finalSpeed, speedLimit, brakingDistance);
  displayPhysicalAnalysis(finalSpeed, brakingDistance); // Llamar a la función de análisis físico
}

function displayFinalStats(
  maxSpeed,
  totalDistanceCovered,
  totalTime,
  exceededLimit
) {
  const statsContainer = document.getElementById("stats-container");
  const statsHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white p-4 rounded-lg shadow-md">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-blue-600">Velocidad Máxima</h3>
          <span class="text-2xl font-bold">${maxSpeed.toFixed(2)} km/h</span>
        </div>
        <div class="mt-2 relative pt-1">
          <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
            <div style="width:${Math.min(
              (maxSpeed / 120) * 100,
              100
            )}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-md">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-green-600">Distancia Total</h3>
          <span class="text-2xl font-bold">${totalDistanceCovered.toFixed(
            2
          )} m</span>
        </div>
        <div class="mt-2 relative pt-1">
          <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-green-200">
            <div style="width:${Math.min(
              (totalDistanceCovered / 1000) * 100,
              100
            )}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"></div>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-md">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-yellow-600">Tiempo Total</h3>
          <span class="text-2xl font-bold">${totalTime.toFixed(2)} s</span>
        </div>
        <div class="mt-2 relative pt-1">
          <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-yellow-200">
            <div style="width:${Math.min(
              (totalTime / 60) * 100,
              100
            )}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"></div>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-md">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold ${
            exceededLimit ? "text-red-600" : "text-green-600"
          }">Estado</h3>
          <span class="text-2xl font-bold">${
            exceededLimit ? "Límite Excedido" : "Dentro del Límite"
          }</span>
        </div>
        <div class="mt-2 text-center">
          <i class="fas ${
            exceededLimit
              ? "fa-exclamation-triangle text-red-500"
              : "fa-check-circle text-green-500"
          } text-4xl"></i>
        </div>
      </div>
    </div>
  `;
  statsContainer.innerHTML = statsHTML;
  document.getElementById("final-stats").classList.remove("hidden");
}

function displaySafetyTips(exceededLimit) {
  const tipsContainer = document.getElementById("tips-container");
  let tipsHTML;

  if (exceededLimit) {
    tipsHTML = `
          <div class="bg-red-100 text-red-600 p-4 rounded-lg shadow-md transition-opacity duration-300">
              <p>⚠️ Has superado el límite de velocidad. Modera tu velocidad especialmente en zonas residenciales.</p>
          </div>
          <div class="bg-yellow-100 text-yellow-600 p-4 rounded-lg shadow-md transition-opacity duration-300">
              <p>🚦 Mantén una distancia segura con otros vehículos y evita frenar bruscamente.</p>
          </div>
      `;
  } else {
    tipsHTML = `
          <div class="bg-green-100 text-green-600 p-4 rounded-lg shadow-md transition-opacity duration-300">
              <p>✅ Has mantenido una velocidad adecuada. Recuerda siempre seguir las señales de tráfico.</p>
          </div>
      `;
  }

  tipsContainer.innerHTML = tipsHTML;
  document.getElementById("safety-tips").classList.remove("hidden");
}

function resetSimulation() {
  // Detener la animación de la simulación
  cancelAnimationFrame(animationId);
  currentPosition = 0;
  currentSpeed = 0;
  isBraking = false;
  startTime = null;
  simulationData = [];

  // Restablecer la posición del vehículo
  const vehicleMarker = document.getElementById("vehicle-marker");
  if (vehicleMarker) {
    vehicleMarker.style.left = "0%";
  }

  // Restablecer la posición visual del vehículo y de las casas
  car.style.left = "0";
  car.querySelectorAll(".wheel").forEach((wheel) => {
    wheel.style.transform = "rotate(0deg)";
    wheel.style.animationPlayState = "paused";
  });
  housesContainer.style.transform = "translateX(0)";
  flash.classList.add("hidden");

  // Restablecer el medidor de velocidad y la distancia de frenado
  document.getElementById("current-speed").textContent = "0 km/h";
  document.getElementById("braking-distance").textContent = "0 m";

  // Restablecer las gráficas de posición y velocidad
  positionTimeChart.data.labels = [];
  positionTimeChart.data.datasets[0].data = [];
  positionTimeChart.update();

  velocityTimeChart.data.labels = [];
  velocityTimeChart.data.datasets[0].data = [];
  velocityTimeChart.update();

  // Restablecer la gráfica de aceleración
  accelerationTimeChart.data.labels = [];
  accelerationTimeChart.data.datasets[0].data = [];
  accelerationTimeChart.update();

  // Restablecer la gráfica de fuerza de fricción (si fue añadida)
  if (typeof frictionForceChart !== "undefined") {
    frictionForceChart.data.labels = [];
    frictionForceChart.data.datasets[0].data = [];
    frictionForceChart.update();
  }

  // Ocultar y limpiar el contenedor de resultados
  resultsContainer.innerHTML = "";
  document.getElementById("safety-tips").classList.add("hidden");
  document.getElementById("tips-container").innerHTML = "";
  document.getElementById("final-stats").classList.add("hidden");
  document.getElementById("physical-analysis").classList.add("hidden");
  document.getElementById("stats-container").innerHTML = "";

  // Reactivar el botón de frenar
  brakeBtn.disabled = false;

  // Resetear el selector de condiciones climáticas al valor predeterminado
  const weatherSelect = document.getElementById("weather");
  if (weatherSelect) {
    weatherSelect.value = "dry";
  }
}
