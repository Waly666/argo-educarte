const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nombres:  { type: String, trim: true },
    apellidos:{ type: String, trim: true },
    email:    { type: String, trim: true, lowercase: true },
    rol:      { type: String, trim: true, default: 'usuario' },
    activo:   { type: Boolean, default: true },
    /** Alias adicionales para iniciar sesión (ej. waly666, walter). */
    loginAliases: { type: [String], default: [] },
    /** Legacy: mismo valor que documento del empleado (índice único en BD) */
    numero: { type: Number, index: true },
    numeroDocumento: { type: String, trim: true },
    idEmpleado: { type: Number, index: true },
    /** Sedes donde puede operar (idSede). Admin ve todas aunque no esté listado. */
    sedesPermitidas: { type: [String], default: [] },
    /** 2FA TOTP (ERP web) — secreto cifrado AES-256-GCM */
    totpEnabled: { type: Boolean, default: false },
    totpSecretEnc: { type: String, default: null },
    totpPendingEnc: { type: String, default: null },
    totpPendingAt: { type: Date, default: null },
    totpEnrolledAt: { type: Date, default: null },
    mfaRecoveryHashes: { type: [String], default: [] },
  },
  { collection: 'usuarios', timestamps: true, strict: false },
);

UsuarioSchema.methods.compararPassword = function (plain) {
  return bcrypt.compare(plain || '', this.passwordHash || '');
};

UsuarioSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(String(plain ?? ''), 10);
};

UsuarioSchema.set('toJSON', {
  virtuals: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    if (ret.nickName != null) ret.nickName = String(ret.nickName).trim().toLowerCase();
    return ret;
  },
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
