const mongoose = require('mongoose');

const ImagenBlogSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    leyenda: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const BlogPostSchema = new mongoose.Schema(
  {
    titulo: { type: String, trim: true, required: true },
    slug: { type: String, trim: true, required: true, unique: true, index: true },
    contenido: { type: String, trim: true, default: '' },
    imagenes: { type: [ImagenBlogSchema], default: [] },
    autorNombre: { type: String, trim: true, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    publicado: { type: Boolean, default: false, index: true },
    publicadoAt: { type: Date, default: null },
  },
  { collection: 'blogPosts', timestamps: true },
);

module.exports = mongoose.model('BlogPost', BlogPostSchema);
