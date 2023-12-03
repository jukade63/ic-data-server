const express = require("express");
const mysql = require("mysql2");
const multer = require('multer')
const crypto = require('crypto')
const sharp = require('sharp')
const cors = require("cors");
const { uploadFile, deleteFile, getObjectSignedUrl } = require("./s3.js");

const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const generateFileName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

// MySQL connection configuration
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "cu_test",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL");
});

// create new user
app.post("/addUser", upload.single("image"), async (req, res) => {
  console.log(req.body.id);
  const file = req.file;
  const id= req.body.id;
  const firstname = req.body.firstname
  const lastname = req.body.lastname
  const DOB = req.body.DOB
  const address = req.body.address
  const imageName = generateFileName();

  if(file){
    const fileBuffer = await sharp(file.buffer)
    .resize({ height: 1920, width: 1080, fit: "contain" })
    .toBuffer();
    await uploadFile(fileBuffer, imageName, file.mimetype);
  }
 
  if (!id || !firstname || !lastname || !DOB || !address) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Insert data into the 'users' table
  const insertUserQuery = `INSERT INTO users (id, firstname, lastname, DOB, address, imageName) VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(
    insertUserQuery,
    [id, firstname, lastname, DOB, address, imageName],
    (err, result) => {
      if (err) {
        console.error("Error inserting user: " + err.stack);
        return res.status(500).json({ message: "Error inserting user" });
      }
      console.log("User added to the database");
      res.status(201).json({ message: "User added successfully" });
    }
  );
});

// update user data
app.put("/update-user/:userId", (req, res) => {
  const updatedUserData = req.body;
  const userId = updatedUserData.id;

  db.query(
    "UPDATE users SET ? WHERE id = ?",
    [updatedUserData, userId],
    (error, results) => {
      if (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Error updating user" });
      } else if (results.affectedRows === 0) {
        res.status(404).json({ message: "User not found" });
      } else {
        res.status(200).json({ message: "User data updated successfully" });
      }
    }
  );
});

// Get user by ID
app.get("/get-user/:userId", (req, res) => {
  const userId = req.params.userId;

  db.query("SELECT * FROM users WHERE id = ?", [userId], async (error, results) => {
    if (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Error fetching user" });
    } else if (results.length === 0) {
      res.status(404).json({ message: "User not found" });
    } else {
      const user = results[0]
      user.imageUrl = await getObjectSignedUrl(user.imageName)
      res.status(200).json({ user });
    }
  });
});

// Set the server to listen on a specific port
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
