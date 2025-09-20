const express = require("express");
const { isLoggedIn } = require("../controllers/authController");

const router = express.Router();

// Render chat page (only if logged in)
router.get("/", isLoggedIn, (req, res) => {
  if (!res.locals.user) {
    return res.redirect("/login"); // not logged in
  }

  res.status(200).render("chat", {
    title: "Chat App",
    user: res.locals.user // pass user explicitly for chat.js
  });
});

module.exports = router;
