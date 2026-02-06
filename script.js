
// url de la api de películas
const API_URL = "https://devsapihub.com/api-movies";

// contenedor principal donde se renderizan las películas
const moviesContainer = document.getElementById("movies");

// claves y duración del cache (feedback: cache y offline support)
const CACHE_KEY = "movies-cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos


// circuit breaker (feedback)

// estado global del circuit breaker
const circuitBreaker = {
  state: "CLOSED",          // estados: CLOSED, OPEN, HALF
  failureCount: 0,          // número de fallos consecutivos
  failureThreshold: 3,      // fallos permitidos antes de abrir el circuito
  timeout: 10000,           // tiempo que el circuito permanece abierto
  nextAttempt: Date.now()   // momento para intentar nuevamente
};

// verifica si se permite hacer una petición
function canRequest() {
  // si el circuito está abierto, se bloquean peticiones
  if (circuitBreaker.state === "OPEN") {
    // si ya pasó el tiempo de espera, pasamos a estado HALF
    if (Date.now() > circuitBreaker.nextAttempt) {
      circuitBreaker.state = "HALF";
      return true;
    }
    return false;
  }
  return true;
}

// se llama cuando una petición fue exitosa
function onSuccess() {
  circuitBreaker.failureCount = 0;
  circuitBreaker.state = "CLOSED";
}

// se llama cuando una petición falla
function onFailure() {
  circuitBreaker.failureCount++;

  // si supera el umbral, se abre el circuito
  if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
    circuitBreaker.state = "OPEN";
    circuitBreaker.nextAttempt = Date.now() + circuitBreaker.timeout;
    console.warn("circuit breaker abierto");
  }
}

// retry con backoff exponencial (feedback)

    // función fetch con retry automático
    async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
      try {
        const response = await fetch(url, options);

        // si la respuesta no es correcta, lanzamos error
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response;

      } catch (error) {
        // si no quedan intentos, propagamos el error
        if (retries === 0) {
          throw error;
        }

        // esperamos antes de reintentar (backoff)
        console.warn(`retry... intentos restantes: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // reintento con más tiempo de espera
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
    }


// función principal para obtener películas

  async function getMovies() {
    // primero intentamos obtener datos del cache
    const cached = getCachedMovies();

    if (cached) {
      showMovies(cached.data);

      // si el cache está viejo, se actualiza en background
      if (Date.now() - cached.timestamp > CACHE_DURATION) {
        fetchMoviesAndCache();
      }
      return;
    }

    // si no hay cache, se hace fetch normal
    await fetchMoviesAndCache();
  }


// fetch real con timeout + retry + circuit breaker

  async function fetchMoviesAndCache() {
    // feedback: circuit breaker evita llamadas innecesarias
    if (!canRequest()) {
      showError("service temporarily unavailable. please try again later.");
      return;
    }

    try {
      // abort controller para timeout (feedback)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // fetch con retry
      const response = await fetchWithRetry(API_URL, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // validación de estructura de datos (feedback)
      if (!Array.isArray(data)) {
        throw new Error("invalid api response format");
      }

      // guardamos datos en cache
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );

      // marcamos éxito en el circuit breaker
      onSuccess();

      // renderizamos películas
      showMovies(data);

    } catch (error) {
      // registramos fallo en el circuit breaker
      onFailure();

      // manejamos el error de forma amigable
      handleError(error);
    }
  }


// renderizado seguro de películas (feedback: xss)

function showMovies(movies) {
  moviesContainer.innerHTML = "";

  // intersection observer para lazy loading (performance)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  }, { rootMargin: "100px" });

  movies.forEach(movie => {
    const article = createMovieCard(movie);
    moviesContainer.appendChild(article);

    const img = article.querySelector("img");
    observer.observe(img);
  });
}


// creación segura de tarjetas (sin innerHTML peligroso)

function createMovieCard(movie) {
  const article = document.createElement("article");
  article.className = "col-md-4";

  const card = document.createElement("article");
  card.className = "card h-100 shadow movie-card";

  // imagen con sanitización de url
  const img = document.createElement("img");
  img.dataset.src = sanitizeUrl(movie.image_url);
  img.src = placeholderImage();
  img.className = "card-img-top";
  img.alt = `poster of ${escapeHtml(movie.title)}`;
  img.loading = "lazy";

  const body = document.createElement("section");
  body.className = "card-body";

  // textContent evita inyección de scripts (feedback seguridad)
  const title = document.createElement("h5");
  title.className = "card-title";
  title.textContent = movie.title;

  const description = document.createElement("p");
  description.className = "card-text";
  description.textContent = movie.description;

  body.append(title, description);

  const footer = document.createElement("footer");
  footer.className = "card-footer text-muted small";
  footer.textContent = `🍿 ${movie.genre} · 📅 ${movie.year} · ⭐ ${movie.stars}/5`;

  card.append(img, body, footer);
  article.appendChild(card);

  return article;
}


// manejo de errores (feedback)

function handleError(error) {
  console.error("error fetching movies:", error);

  let message = "unable to load movies.";

  if (error.name === "AbortError") {
    message = "request timed out. please try again.";
  } else if (error.message.includes("HTTP")) {
    message = "server error. please try later.";
  } else if (error.message.includes("fetch")) {
    message = "network error. check your connection.";
  }

  showError(message);
}

function showError(message) {
  moviesContainer.innerHTML = "";

  const section = document.createElement("section");
  section.className = "col-12 text-center py-5";

  const alert = document.createElement("div");
  alert.className = "alert alert-danger";
  alert.textContent = message;

  const button = document.createElement("button");
  button.className = "btn btn-primary mt-3";
  button.textContent = "try again";
  button.addEventListener("click", getMovies);

  section.append(alert, button);
  moviesContainer.appendChild(section);
}


// helpers de seguridad

  // escapa texto para evitar inyección html
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // valida urls externas (solo https)
  function sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" ? parsed.toString() : "#";
    } catch {
      return "#";
    }
  }

  // imagen placeholder para lazy loading
  function placeholderImage() {
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2U5ZWNlZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYWFhIj5sb2FkaW5nPC90ZXh0Pjwvc3ZnPg==";
  }


  // cache helpers

  function getCachedMovies() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!cached || !Array.isArray(cached.data)) return null;
      return cached;
    } catch {
      return null;
    }
  }



getMovies();
