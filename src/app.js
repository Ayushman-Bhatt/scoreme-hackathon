require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const requestRoutes = require("./routes/request.routes");

const app = express();

app.use(express.json());

// Mount routes with trailing slash to handle all /api/* paths
app.use("/api/", requestRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

async function startServer() {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
