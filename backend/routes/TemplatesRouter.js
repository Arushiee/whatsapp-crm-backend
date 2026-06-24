const express    = require("express")
const router     = express.Router()
const { sequelize } = require("../config/db")
const { QueryTypes } = require("sequelize")

async function initTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS templates (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(255)  NOT NULL,
      group_name    VARCHAR(100)  DEFAULT NULL,
      category      ENUM('MARKETING','UTILITY','AUTHENTICATION') NOT NULL DEFAULT 'MARKETING',
      languages     VARCHAR(50)   NOT NULL DEFAULT 'en',
      status        ENUM('APPROVED','PENDING','REJECTED') NOT NULL DEFAULT 'PENDING',
      show_in_chat  TINYINT(1)    NOT NULL DEFAULT 1,
      header_type   ENUM('none','text','image','video','document') DEFAULT 'none',
      header_value  TEXT          DEFAULT NULL,
      body          TEXT          NOT NULL,
      footer        VARCHAR(255)  DEFAULT NULL,
      buttons       JSON          DEFAULT NULL,
      created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log("[templates] Table ready.")
}

initTable().catch(console.error)

router.get("/", async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1)
    const limit    = Math.min(100, parseInt(req.query.limit) || 10)
    const offset   = (page - 1) * limit
    const search   = req.query.search   || ""
    const group    = req.query.group    || ""
    const category = req.query.category || ""
    const status   = req.query.status   || ""
    const header   = req.query.header   || ""
    const conditions = []
    const replacements = {}
    if (search) { conditions.push("name LIKE :search"); replacements.search = `%${search}%` }
    if (group && group !== "All Groups") { conditions.push("group_name = :group"); replacements.group = group }
    if (category && category !== "All Categories") { conditions.push("category = :category"); replacements.category = category }
    if (status && status !== "All Templates") { conditions.push("status = :status"); replacements.status = status }
    if (header && header !== "All Media") { conditions.push("header_type = :header"); replacements.header = header }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const [{ total }] = await sequelize.query(`SELECT COUNT(*) AS total FROM templates ${where}`, { replacements, type: QueryTypes.SELECT })
    const rows = await sequelize.query(`SELECT * FROM templates ${where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`, { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT })
    res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error("[GET /templates]", err)
    res.status(500).json({ error: "Failed to fetch templates." })
  }
})

router.get("/groups", async (req, res) => {
  try {
    const rows = await sequelize.query("SELECT DISTINCT group_name FROM templates WHERE group_name IS NOT NULL ORDER BY group_name", { type: QueryTypes.SELECT })
    res.json(rows.map((r) => r.group_name))
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch groups." })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const [row] = await sequelize.query("SELECT * FROM templates WHERE id = :id", { replacements: { id: req.params.id }, type: QueryTypes.SELECT })
    if (!row) return res.status(404).json({ error: "Template not found." })
    res.json(row)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch template." })
  }
})

router.post("/", async (req, res) => {
  try {
    const { name, group_name, category = "MARKETING", languages = "en", status = "PENDING", show_in_chat = 1, header_type = "none", header_value, body, footer, buttons } = req.body
    if (!name || !body) return res.status(400).json({ error: "name and body are required." })
    const [insertId] = await sequelize.query(
      `INSERT INTO templates (name, group_name, category, languages, status, show_in_chat, header_type, header_value, body, footer, buttons) VALUES (:name, :group_name, :category, :languages, :status, :show_in_chat, :header_type, :header_value, :body, :footer, :buttons)`,
      { replacements: { name, group_name: group_name || null, category, languages, status, show_in_chat: show_in_chat ? 1 : 0, header_type, header_value: header_value || null, body, footer: footer || null, buttons: buttons ? JSON.stringify(buttons) : null }, type: QueryTypes.INSERT }
    )
    const [newRow] = await sequelize.query("SELECT * FROM templates WHERE id = :id", { replacements: { id: insertId }, type: QueryTypes.SELECT })
    res.status(201).json(newRow)
  } catch (err) {
    console.error("[POST /templates]", err)
    res.status(500).json({ error: "Failed to create template." })
  }
})

router.put("/:id", async (req, res) => {
  try {
    const { name, group_name, category, languages, status, show_in_chat, header_type, header_value, body, footer, buttons } = req.body
    await sequelize.query(
      `UPDATE templates SET name=:name, group_name=:group_name, category=:category, languages=:languages, status=:status, show_in_chat=:show_in_chat, header_type=:header_type, header_value=:header_value, body=:body, footer=:footer, buttons=:buttons WHERE id=:id`,
      { replacements: { name, group_name: group_name || null, category, languages, status, show_in_chat: show_in_chat ? 1 : 0, header_type, header_value: header_value || null, body, footer: footer || null, buttons: buttons ? JSON.stringify(buttons) : null, id: req.params.id }, type: QueryTypes.UPDATE }
    )
    const [updated] = await sequelize.query("SELECT * FROM templates WHERE id = :id", { replacements: { id: req.params.id }, type: QueryTypes.SELECT })
    if (!updated) return res.status(404).json({ error: "Template not found." })
    res.json(updated)
  } catch (err) {
    console.error("[PUT /templates]", err)
    res.status(500).json({ error: "Failed to update template." })
  }
})

router.patch("/:id/show-in-chat", async (req, res) => {
  try {
    await sequelize.query("UPDATE templates SET show_in_chat = NOT show_in_chat WHERE id = :id", { replacements: { id: req.params.id }, type: QueryTypes.UPDATE })
    const [row] = await sequelize.query("SELECT id, show_in_chat FROM templates WHERE id = :id", { replacements: { id: req.params.id }, type: QueryTypes.SELECT })
    res.json(row)
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle show_in_chat." })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    await sequelize.query("DELETE FROM templates WHERE id = :id", { replacements: { id: req.params.id }, type: QueryTypes.DELETE })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete template." })
  }
})

module.exports = router
