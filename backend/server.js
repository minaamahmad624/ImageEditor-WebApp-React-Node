const express = require("express")
const cors = require("cors")
const multer = require("multer")
const sharp = require("sharp")
const { v4: uuidv4 } = require("uuid")
const fs = require("fs")
const path = require("path")

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

const storage = multer.memoryStorage()
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

const imagesDir = path.join(__dirname, "images")
const dataFile = path.join(__dirname, "data.json")

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir)
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]")
}

// Middleware to handle errors
const errorHandler = (err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: "Internal server error" })
}

app.use(errorHandler)

// Middleware to validate image file
const validateImage = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" })
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Invalid file type" })
  }

  next()
}

app.post("/api/upload", upload.single("image"), validateImage, async (req, res) => {
  try {
    const id = uuidv4()
    const filename = `${id}.webp`
    const filepath = path.join(imagesDir, filename)

    // Optimize image
    await sharp(req.file.buffer)
      .webp({ quality: 80 })
      .resize(2000, 2000, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFile(filepath)

    const imageData = {
      id,
      filename,
      originalName: req.file.originalname,
      editedAt: new Date().toISOString(),
      size: req.file.size,
      type: req.file.mimetype,
    }

    const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
    data.push(imageData)
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))

    res.json(imageData)
  } catch (error) {
    next(error)
  }
})

app.get("/api/images", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
    res.json(data)
  } catch (error) {
    next(error)
  }
})

app.get("/api/images/:id", (req, res) => {
  try {
    const filepath = path.join(imagesDir, `${req.params.id}.webp`)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Image not found" })
    }
    res.sendFile(filepath)
  } catch (error) {
    next(error)
  }
})

app.post("/api/edit", upload.single("image"), validateImage, async (req, res) => {
  try {
    const { rotate = 0, flip = false, flop = false, brightness = 1, contrast = 1, grayscale = false } = req.body

    let image = sharp(req.file.buffer)

    if (rotate) image = image.rotate(Number.parseInt(rotate))
    if (flip === "true") image = image.flip()
    if (flop === "true") image = image.flop()
    if (brightness) image = image.modulate({ brightness: Number.parseFloat(brightness) })
    if (contrast) image = image.linear(Number.parseFloat(contrast), -(128 * (Number.parseFloat(contrast) - 1)))
    if (grayscale === "true") image = image.grayscale()

    const editedBuffer = await image.webp({ quality: 80 }).toBuffer()

    res.contentType("image/webp").send(editedBuffer)
  } catch (error) {
    next(error)
  }
})

app.post("/api/save", upload.single("image"), validateImage, async (req, res) => {
  try {
    const id = uuidv4()
    const filename = `${id}.webp`
    const filepath = path.join(imagesDir, filename)

    await sharp(req.file.buffer).webp({ quality: 80 }).toFile(filepath)

    const imageData = {
      id,
      filename,
      originalName: req.file.originalname || "edited-image.webp",
      editedAt: new Date().toISOString(),
      size: req.file.size,
      type: "image/webp",
    }

    const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
    data.push(imageData)
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))

    res.json(imageData)
  } catch (error) {
    next(error)
  }
})

// Delete image endpoint
app.delete("/api/images/:id", (req, res) => {
  try {
    const filepath = path.join(imagesDir, `${req.params.id}.webp`)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Image not found" })
    }

    fs.unlinkSync(filepath)

    const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
    const updatedData = data.filter((img) => img.id !== req.params.id)
    fs.writeFileSync(dataFile, JSON.stringify(updatedData, null, 2))

    res.json({ message: "Image deleted successfully" })
  } catch (error) {
    next(error)
  }
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

