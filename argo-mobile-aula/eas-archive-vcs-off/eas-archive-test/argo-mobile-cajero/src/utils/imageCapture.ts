import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import type { SoportePago } from './pago';

export type OrigenImagen = 'camara' | 'galeria';

function normalizeAsset(asset: ImagePicker.ImagePickerAsset, prefijo: string): SoportePago {
  const mime = asset.mimeType || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName || `${prefijo}-${Date.now()}.${ext}`,
    type: mime,
  };
}

async function permisoCamara(): Promise<boolean> {
  const cur = await ImagePicker.getCameraPermissionsAsync();
  if (cur.granted) return true;
  const req = await ImagePicker.requestCameraPermissionsAsync();
  if (req.granted) return true;
  Alert.alert(
    'Cámara',
    'Active el permiso de cámara en Ajustes del celular para escanear la cédula.',
  );
  return false;
}

async function permisoGaleria(): Promise<boolean> {
  const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (cur.granted) return true;
  const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (req.granted) return true;
  Alert.alert(
    'Fotos',
    'Active el permiso de fotos para elegir una imagen de la cédula.',
  );
  return false;
}

const pickerOpts: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.92,
  exif: false,
  allowsEditing: false,
};

/** Solo frente de la cédula (documento y nombres). */
export async function capturarImagenCedula(origen: OrigenImagen): Promise<SoportePago | null> {
  if (origen === 'camara') {
    if (!(await permisoCamara())) return null;
    const res = await ImagePicker.launchCameraAsync({
      ...pickerOpts,
      cameraType: ImagePicker.CameraType.back,
    });
    if (res.canceled || !res.assets[0]) return null;
    return normalizeAsset(res.assets[0], 'cedula-cam');
  }
  if (!(await permisoGaleria())) return null;
  const res = await ImagePicker.launchImageLibraryAsync(pickerOpts);
  if (res.canceled || !res.assets[0]) return null;
  return normalizeAsset(res.assets[0], 'cedula-galeria');
}

export async function capturarFotoAlumno(origen: OrigenImagen): Promise<SoportePago | null> {
  if (origen === 'camara') {
    if (!(await permisoCamara())) return null;
    const res = await ImagePicker.launchCameraAsync({
      ...pickerOpts,
      cameraType: ImagePicker.CameraType.front,
    });
    if (res.canceled || !res.assets[0]) return null;
    return normalizeAsset(res.assets[0], 'foto-alumno');
  }
  if (!(await permisoGaleria())) return null;
  const res = await ImagePicker.launchImageLibraryAsync(pickerOpts);
  if (res.canceled || !res.assets[0]) return null;
  return normalizeAsset(res.assets[0], 'foto-alumno');
}
