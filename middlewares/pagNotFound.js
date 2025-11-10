// middlewares/notFound.js

export function pagNotFound(req, res, next) {
    res.status(404).json({
      message: "URL Introuvable",
    //   url: req.originalUrl,
    //   method: req.method
    });
  }
  