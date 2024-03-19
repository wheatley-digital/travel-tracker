import express from "express";
import pg from "pg";
import "dotenv/config";

// Variables
const port = process.env.INDEXJSPORT;
var countriesVisited = [];
var countryIndex = 0;
var user_id = 0;

// Functions
function toTitleCase(str) {
  return str.toLowerCase().replace(/(^|\s)\w/g, function (firstLetter) {
    return firstLetter.toUpperCase();
  });
}

// Use express function
const app = express();

// Serve public folder files to server
app.use(express.static("public"));

// Use express middleware
app.use(express.urlencoded({ extended: true }));

// Listen on specified port
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Configure connection pool
const pool = new pg.Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }, // This option might be required depending on your PostgreSQL server settings
  user: process.env.USERNAME,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: process.env.PORT, // Default PostgreSQL port
});

app.get("/", async (req, res) => {
  try {
    const userIdExistsQuery = await pool.query(
      "SELECT COUNT(users.id) FROM users WHERE users.id = $1;",
      [user_id]
    );
    const userIdExists = parseInt(userIdExistsQuery.rows[0].count);
    if (userIdExists === 0) {
      const userIdQuery = await pool.query(
        "SELECT users.id FROM users LIMIT 1;"
      );
      user_id = userIdQuery.rows[0].id;
    }
    const usersQuery = await pool.query("SELECT user_name FROM users;");
    const users = usersQuery.rows;
    const userNames = users.map((obj) => obj.user_name);
    const userQuery = await pool.query("SELECT * FROM users WHERE id = $1;", [
      user_id,
    ]);
    const user = userQuery.rows;
    const visitedQuery = await pool.query(
      "SELECT visited.id, country_code, country_name FROM ((visited INNER JOIN users ON visited.user_id = users.id) INNER JOIN countries ON country_id = countries.id) WHERE users.id = $1;",
      [user_id]
    );
    const visited = visitedQuery.rows;
    var visitedCountryNames = visited.map((obj) => obj.country_name);
    visitedCountryNames = visitedCountryNames.map((item) => item.toLowerCase());
    var visitedCountryCodes = visited.map((obj) => obj.country_code);
    visitedCountryCodes = visitedCountryCodes.map((item) => item);

    res.render("index.ejs", {
      visitedCountryCodes: visitedCountryCodes,
      user: user[0],
      users: userNames,
    });
  } catch (err) {
    console.error("Error executing query", err);
    res.render("index.ejs", {
      visitedCountryCodes: [],
      user: "No User",
      users: [],
    });
  }
});

app.post("/add-country", async (req, res) => {
  const user_id = parseInt(req.body.id);
  try {
    const titleCaseCountry = req.body.country.toLowerCase();
    const countryIdQuery = await pool.query(
      "SELECT countries.id FROM countries WHERE LOWER(countries.country_name) = $1;",
      [titleCaseCountry]
    );
    const countryId = countryIdQuery.rows[0].id;
    const insertCountry = await pool.query(
      "INSERT INTO visited (user_id, country_id) VALUES ($1, $2);",
      [user_id, countryId]
    );
  } catch (err) {
    console.error(err);
  }
  res.redirect("/");
});

app.post("/delete-country", async (req, res) => {
  const user_id = parseInt(req.body.id);
  try {
    const titleCaseCountry = req.body.country.toLowerCase();
    const countryIdQuery = await pool.query(
      "SELECT countries.id FROM countries WHERE LOWER(countries.country_name) = $1;",
      [titleCaseCountry]
    );
    const countryId = countryIdQuery.rows[0].id;
    const deleteVisitedCountry = await pool.query(
      "DELETE FROM visited WHERE user_id = $1 AND country_id = $2;",
      [user_id, countryId]
    );
  } catch (err) {
    console.error(err);
  }
  res.redirect("/");
});

app.post("/select-user", async (req, res) => {
  const user = req.body.user;
  const userIdQuery = await pool.query(
    "SELECT users.id FROM users WHERE user_name = $1;",
    [user]
  );
  const userId = userIdQuery.rows[0].id;
  user_id = userId;
  res.redirect("/");
});

app.post("/add-new-user", async (req, res) => {
  try {
    const newUserName = toTitleCase(req.body["new-user"]);
    const newUserColour = toTitleCase(req.body["colour"]);
    const userExistsQuery = await pool.query(
      "SELECT COUNT(users.id) FROM users WHERE users.user_name = $1;",
      [newUserName]
    );
    const userExists = parseInt(userExistsQuery.rows[0].count);
    if (userExists === 0) {
      const newUserQuery = await pool.query(
        "INSERT INTO users (user_name, colour) VALUES ($1, $2);",
        [newUserName, newUserColour]
      );
      const user = req.body["new-user"].toLowerCase();
      const userIdQuery = await pool.query(
        "SELECT users.id FROM users WHERE LOWER(user_name) = $1;",
        [user]
      );
      const userId = userIdQuery.rows[0].id;
      user_id = userId;
    }
  } catch (err) {
    console.error(err);
  }
  res.redirect("/");
});

app.post("/delete-user", async (req, res) => {
  const userName = toTitleCase(req.body["delete-user"]);
  const currentUserId = parseInt(req.body["current-user"]);
  try {
    // Get user id from user name
    const userIdQuery = await pool.query(
      "SELECT users.id FROM users WHERE user_name = $1;",
      [userName]
    );
    const userId = userIdQuery.rows[0].id;
    // Delete all rows from visited table where user id exists
    const deleteUserFromVisited = await pool.query(
      "DELETE FROM visited WHERE user_id = $1;",
      [userId]
    );
    // Delete user from users table
    const deleteUserFromUsers = await pool.query(
      "DELETE FROM users WHERE users.id = $1;",
      [userId]
    );

    if (currentUserId === userId) {
      user_id = 1;
    }
  } catch (err) {
    console.log(err);
  }
  res.redirect("/");
});
