const express = require("express");

const port = 5000;
const app = express();

app.get("/api/data", (req, res) => {
  setTimeout(() => {}, 2000);

  res.json({
    name: "karan",
    class: 5,
    data: "hello",
  });
});

app.listen(port, () => {
  console.log("listening on port ", port);
});
