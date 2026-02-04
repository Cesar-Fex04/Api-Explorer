const API_URL = "https://devsapihub.com/api-movies";

const moviesContainer = document.getElementById("movies");

async function getMovies() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    showMovies(data);
  } catch (error) {
    moviesContainer.innerHTML = `
      <p class="text-danger">Error loading movies. Check your connection.</p>
    `;
  }
}


/*
Api info
 {
        "id": 1,
        "title": "The Shawshank Redemption",
        "description": "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
        "year": 1994,
        "image_url": "https://devsapihub.com/img-movies/1.jpg",
        "genre": "Drama",
        "stars": 5
    },
 */


function showMovies(movies) {
  moviesContainer.innerHTML = "";

  movies.forEach(movie => {
    const article = document.createElement("article");
    article.className = "col-md-4";

    article.innerHTML = `
      <article class="card h-100 shadow-sm">
        
        <img 
          src="${movie.image_url}" 
          class="card-img-top" 
          alt="Poster of ${movie.title}"
        >

        <section class="card-body">
          <h5 class="card-title">${movie.title}</h5>
          <p class="card-text">${movie.description}</p>
        </section>

        <section class="card-footer text-muted small">
          <span>🎬 ${movie.genre}</span> |
          <span>📅 ${movie.year}</span> |
          <span>⭐ ${movie.stars}/5</span>
        </section>

      </article>
    `;

    moviesContainer.appendChild(article);
  });
}


getMovies();
