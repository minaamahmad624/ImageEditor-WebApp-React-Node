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
const upload = multer({ storage: storage })

const imagesDir = path.join(__dirname, "images")
const dataFile = path.join(__dirname, "data.json")

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir)
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]")
}

app.post("/api/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" })
  }

  const id = uuidv4()
  const filename = `${id}.png`
  const filepath = path.join(imagesDir, filename)

  await sharp(req.file.buffer).png().toFile(filepath)

  const imageData = {
    id,
    filename,
    originalName: req.file.originalname,
    editedAt: new Date().toISOString(),
  }

  const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
  data.push(imageData)
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))

  res.json(imageData)
})

app.get("/api/images", (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
  res.json(data)
})

app.get("/api/images/:id", (req, res) => {
  const filepath = path.join(imagesDir, `${req.params.id}.png`)
  res.sendFile(filepath)
})

app.post("/api/edit", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" })
  }

  const { rotate, flip, flop, brightness, contrast, grayscale } = req.body

  let image = sharp(req.file.buffer)

  if (rotate) image = image.rotate(Number.parseInt(rotate))
  if (flip === "true") image = image.flip()
  if (flop === "true") image = image.flop()
  if (brightness) image = image.modulate({ brightness: Number.parseFloat(brightness) })
  if (contrast) image = image.linear(Number.parseFloat(contrast), -(128 * (Number.parseFloat(contrast) - 1)))
  if (grayscale === "true") image = image.grayscale()

  const editedBuffer = await image.png().toBuffer()

  res.contentType("image/png").send(editedBuffer)
})

app.post("/api/save", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" })
  }

  const id = uuidv4()
  const filename = `${id}.png`
  const filepath = path.join(imagesDir, filename)

  await sharp(req.file.buffer).png().toFile(filepath)

  const imageData = {
    id,
    filename,
    originalName: req.file.originalname,
    editedAt: new Date().toISOString(),
  }

  const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"))
  data.push(imageData)
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))

  res.json(imageData)
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

