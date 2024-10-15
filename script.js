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
  frictionForceChart = new Chart('friction-force-graph', {
    type: 'line',
    data: {
        datasets: [{
            label: 'Fuerza de Fricción (N)',
            borderColor: 'rgb(54, 162, 235)',
            data: []
        }]
    },
    options: {
        responsive: true,
        animation: { duration: 0 },
        scales: {
            x: { title: { display: true, text: 'Tiempo (s)' } },
            y: { title: { display: true, text: 'Fuerza (N)' } }
        },
        elements: { line: { tension: 0.4 } }
    }
});
}

function attachEventListeners() {
  simulateBtn.addEventListener("click", startSimulation);
  resetBtn.addEventListener("click", resetSimulation);
  brakeBtn.addEventListener("click", applyBrakes);
}

let frictionCoefficient = 0.7; // Default for dry

function startSimulation() {
  const initialSpeed = parseFloat(speedInput.value);
  const totalDistance = parseFloat(distanceInput.value);

  // Obtener el valor del clima
  const weather = document.getElementById('weather').value;

    if (weather === 'rainy') {
        frictionCoefficient = 0.5; // Reduce por lluvia
    } else if (weather === 'snowy') {
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
    const vehicleMarker = document.getElementById('vehicle-marker');
    if (vehicleMarker) {
        const progressPercentage = (currentPosition / totalDistance) * 100;
        vehicleMarker.style.left = `${Math.min(progressPercentage, 100)}%`;
    } else {
        console.error("Elemento 'vehicle-marker' no encontrado.");
    }

    // Verificar y manejar la animación de las casas
    if (currentSpeed > 0 && !housesContainer.classList.contains("animate")) {
        housesContainer.classList.add("animate");
    } else if (currentSpeed <= 0 && housesContainer.classList.contains("animate")) {
        housesContainer.classList.remove("animate");
    }

    // Actualizar el medidor de velocidad en tiempo real
    const speedMeter = document.getElementById('current-speed');
    if (speedMeter) {
        speedMeter.textContent = `${currentSpeed.toFixed(2)} km/h`;
    }

    // Calcular y actualizar la distancia de frenado en tiempo real
    const brakingDistance = calculateBrakingDistance(currentSpeed);
    const brakingDistanceMeter = document.getElementById('braking-distance');
    if (brakingDistanceMeter) {
        brakingDistanceMeter.textContent = `${brakingDistance.toFixed(2)} m`;
    }

    // Calcular la distancia restante hasta la cámara y mostrar aviso si es necesario
    const remainingDistance = totalDistance - currentPosition;
    const brakeAdvice = document.getElementById('brake-advice');
    if (brakeAdvice) {
        if (remainingDistance <= brakingDistance && currentSpeed > 0) {
            brakeAdvice.classList.remove('hidden');
        } else {
            brakeAdvice.classList.add('hidden');
        }
    }

    // Aplicar frenado si se está frenando
    if (isBraking) {
        const deceleration = FRICTION_COEFFICIENT * GRAVITY; // m/s^2
        currentSpeed = Math.max(
            0,
            currentSpeed - deceleration * (elapsedTime - simulationData[simulationData.length - 1].time)
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
    currentPosition += (currentSpeed / 3.6) * (elapsedTime - (simulationData.length ? simulationData[simulationData.length - 1].time : 0));

    updateVisualSimulation(currentPosition, totalDistance);
    updateCharts(elapsedTime, currentPosition, currentSpeed);
    simulationData.push({ time: elapsedTime, position: currentPosition, speed: currentSpeed });

    // Terminar la simulación si se alcanza la distancia total
    if (currentPosition >= totalDistance) {
        endSimulation();
    } else {
        animationId = requestAnimationFrame(updateSimulation);
    }

     // Aplicar sombras dinámicas al vehículo según la velocidad
     if (currentSpeed >= 60) {
        car.classList.add('shadow-dynamic-fast');
        car.classList.remove('shadow-dynamic');
    } else {
        car.classList.add('shadow-dynamic');
        car.classList.remove('shadow-dynamic-fast');
    }

    // Modificar la animación de los árboles según la velocidad
    const treesContainer = document.getElementById('trees-container');
    if (treesContainer) {
        const swaySpeed = Math.max(1, 3 - currentSpeed / 50); // Aumenta la frecuencia con mayor velocidad
        treesContainer.querySelectorAll('.tree').forEach(tree => {
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
  positionTimeChart.data.labels.push(time.toFixed(1));
  positionTimeChart.data.datasets[0].data.push(position.toFixed(2));
  positionTimeChart.update();

  velocityTimeChart.data.labels.push(time.toFixed(1));
  velocityTimeChart.data.datasets[0].data.push(speed.toFixed(2));
  velocityTimeChart.update();
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
        <div class="bg-gray-100 p-4 rounded-lg ${
          exceededLimit ? "border-red-500" : "border-green-500"
        } border-2">
            <h3 class="text-2xl font-bold mb-2 ${
              exceededLimit ? "text-red-500" : "text-green-500"
            }">
                ${
                  exceededLimit
                    ? "¡Fotomulta Activada!"
                    : "Velocidad dentro del límite"
                }
            </h3>
            <p class="mb-2"><strong>Velocidad final:</strong> ${finalSpeed.toFixed(
              2
            )} km/h</p>
            <p class="mb-2"><strong>Límite de velocidad:</strong> ${speedLimit} km/h</p>
            <p class="mb-4"><strong>Distancia de frenado calculada:</strong> ${brakingDistance.toFixed(
              2
            )} m</p>
            <h4 class="text-xl font-semibold mt-4 mb-2">Análisis Físico:</h4>
            <div class="bg-white p-3 rounded">
                <p class="mb-2"><strong>MRU (Movimiento Rectilíneo Uniforme):</strong></p>
                <p class="mb-2">v = d / t, donde v = velocidad, d = distancia, t = tiempo</p>
                <p class="mb-4">Aplicado: ${speedInput.value} km/h = ${
    distanceInput.value
  } m / t</p>
                <p class="mb-2"><strong>MRUA (Movimiento Rectilíneo Uniformemente Acelerado) durante el frenado:</strong></p>
                <p class="mb-2">v_f^2 = v_i^2 + 2a(d), donde v_f = velocidad final, v_i = velocidad inicial, a = aceleración, d = distancia</p>
                <p>Aplicado: ${finalSpeed.toFixed(2)}^2 = ${
    speedInput.value
  }^2 + 2 * (-${(FRICTION_COEFFICIENT * GRAVITY).toFixed(
    2
  )}) * ${brakingDistance.toFixed(2)}</p>
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
   const tipsContainer = document.getElementById('tips-container');
   const safetyTipsSection = document.getElementById('safety-tips');
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
   safetyTipsSection.classList.remove('hidden');

    // Generar y mostrar estadísticas finales
    const statsContainer = document.getElementById('stats-container');
    const finalStatsSection = document.getElementById('final-stats');

    const maxSpeed = Math.max(...simulationData.map(data => data.speed));
    const totalDistanceCovered = simulationData[simulationData.length - 1].position;
    const totalTime = simulationData[simulationData.length - 1].time;

    const statsHTML = `
        <p><strong>Velocidad Máxima Alcanzada:</strong> ${maxSpeed.toFixed(2)} km/h</p>
        <p><strong>Distancia Total Recorrida:</strong> ${totalDistanceCovered.toFixed(2)} m</p>
        <p><strong>Tiempo Total de Simulación:</strong> ${totalTime.toFixed(2)} s</p>
        <p><strong>Fotomultas Generadas:</strong> ${exceededLimit ? 'Sí' : 'No'}</p>
    `;

    statsContainer.innerHTML = statsHTML;
    finalStatsSection.classList.remove('hidden');

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
    const vehicleMarker = document.getElementById('vehicle-marker');
    if (vehicleMarker) {
        vehicleMarker.style.left = '0%';
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
    document.getElementById('current-speed').textContent = '0 km/h';
    document.getElementById('braking-distance').textContent = '0 m';

    // Restablecer las gráficas de posición y velocidad
    positionTimeChart.data.labels = [];
    positionTimeChart.data.datasets[0].data = [];
    positionTimeChart.update();

    velocityTimeChart.data.labels = [];
    velocityTimeChart.data.datasets[0].data = [];
    velocityTimeChart.update();

    // Restablecer la gráfica de fuerza de fricción (si fue añadida)
    if (typeof frictionForceChart !== "undefined") {
        frictionForceChart.data.labels = [];
        frictionForceChart.data.datasets[0].data = [];
        frictionForceChart.update();
    }

    // Ocultar y limpiar el contenedor de resultados
    resultsContainer.innerHTML = "";
    document.getElementById('safety-tips').classList.add('hidden');
    document.getElementById('tips-container').innerHTML = "";
    document.getElementById('final-stats').classList.add('hidden');
    document.getElementById('stats-container').innerHTML = "";

    // Reactivar el botón de frenar
    brakeBtn.disabled = false;

    // Ocultar cualquier aviso de frenado
    const brakeAdvice = document.getElementById('brake-advice');
    if (brakeAdvice) {
        brakeAdvice.classList.add('hidden');
    }

    // Restablecer el coeficiente de fricción al valor predeterminado si es necesario
    frictionCoefficient = 0.7;

    // Resetear el selector de condiciones climáticas al valor predeterminado
    const weatherSelect = document.getElementById('weather');
    if (weatherSelect) {
        weatherSelect.value = 'dry';
    }
}

