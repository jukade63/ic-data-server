const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const crypto = require("crypto");
const cors = require("cors");
const { uploadFile, deleteFile, getObjectSignedUrl } = require("./s3.js");
const path = require("path");

const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const generateFileName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

// MySQL connection configuration
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL");
});

// create new user
app.post("/api/add-user", upload.single("image"), async (req, res) => {
  const file = req.file;
  const id = req.body.id;
  const firstname = req.body.firstname;
  const lastname = req.body.lastname;
  const DOB = req.body.DOB;
  const address = req.body.address;
  let imageName = null;

  if (file) {
    imageName = generateFileName();
    await uploadFile(file.buffer, imageName, file.mimetype);
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
app.put(
  "/api/update-user/:userId",
  upload.single("image"),
  async (req, res) => {
    const file = req.file;
    const userId = req.params.userId;
    const firstname = req.body.firstname;
    const lastname = req.body.lastname;
    const DOB = req.body.DOB;
    const address = req.body.address;
    let imageName = null;

    if (!userId || !firstname || !lastname || !DOB || !address) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (file) {
      imageName = generateFileName();
      await uploadFile(file.buffer, imageName, file.mimetype);
    }

    db.query(
      `UPDATE users SET firstname = ?, lastname = ?, DOB = ?, address = ?, imageName = ? WHERE id = ?`,
      [firstname, lastname, DOB, address, imageName, userId],
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
  }
);

// Get user by ID
app.get("/api/get-user/:userId", (req, res) => {
  const userId = req.params.userId;

  db.query(
    "SELECT * FROM users WHERE id = ?",
    [userId],
    async (error, results) => {
      if (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Error fetching user" });
      } else if (results.length === 0) {
        res.status(404).json({ message: "User not found" });
      } else {
        const user = results[0];
        if (user.imageName) {
          user.imageUrl = await getObjectSignedUrl(user.imageName);
        }
        res.status(200).json({ user });
      }
    }
  );
});

app.delete("/api/delete-user/:userId", (req, res) => {
  const userId = req.params.userId;
  const imageUrl = req.query.imageUrl;

  //fetch imageName from db if user has image profile before deleting all user data
  if (imageUrl) {
    const query = "SELECT imageName FROM users WHERE id = ?";

    db.query(query, [userId], async (error, results) => {
      if (error) {
        console.error("Error retrieving imageName:", error);
        return;
      }

      if (results.length > 0) {
        const imageName = results[0].imageName;
        console.log("Image Name:", imageName);

        //delete user image stored in S3
        await deleteFile(imageName);
      } else {
        console.log("User with ID not found");
      }
    });
  }

  db.query("DELETE FROM users WHERE id = ?", [userId], (error) => {
    if (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Error deleting user" });
      return;
    }

    console.log(`Deleted user with ID ${userId}`);
    res
      .status(200)
      .json({ message: `User with ID ${userId} deleted successfully` });
  });

});

// Set the server to listen on a specific port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
