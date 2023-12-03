const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const aws = require('aws-sdk');
const dotenv = require('dotenv')

dotenv.config()

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'ap-southeast-1',
  signatureVersion: 'v4'
});
// const storage = multer.memoryStorage()
// const upload = multer({ storage: storage })

// MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'cu_test'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL');

});

app.get('/generate-signed-url', (req, res) => {
  const fileName = req.query.fileName;
  const fileType = req.query.fileType;

  const s3Params = {
    Bucket: 'test-icdata',
    Key: fileName,
    Expires: 60,
    ContentType: fileType,
  };

  s3.getSignedUrl('putObject', s3Params, (error, signedUrl) => {
    if (error) {
      console.error('Error generating signed URL:', error);
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }

    res.json({ signedUrl });
  });
});

app.post('/addUser', (req, res) => {
  console.log('req body',req.body);
  const { id, firstname, lastname, DOB, address} = req.body;
  
    if (!id || !firstname || !lastname || !DOB || !address) {
        return res.status(400).json({ message: 'All fields are required' });
      }
    
      // Insert data into the 'users' table
      const insertUserQuery = `INSERT INTO users (id, firstname, lastname, DOB, address) VALUES (?, ?, ?, ?, ?)`;
      db.query(insertUserQuery, [id, firstname, lastname, DOB, address], (err, result) => {
        if (err) {
          console.error('Error inserting user: ' + err.stack);
          return res.status(500).json({ message: 'Error inserting user' });
        }
        console.log('User added to the database');
        res.status(201).json({ message: 'User added successfully' });
      });
  });
  

// Define your routes
// ... (same as previous code example)

// Set the server to listen on a specific port
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});