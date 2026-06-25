import type { PanelAula } from '../api/types';

export type RootStackParamList = {
  Bootstrap: undefined;
  Welcome: undefined;
  Login: undefined;
  Registro: undefined;
  Catalogo: undefined;
  CursoDetalle: { id: string; titulo?: string };
  ConsultaCertificados: undefined;
  AulaHub: { panel?: PanelAula } | undefined;
  CoursePlayer: { idPrograma: string; titulo: string; playerUrl: string; storagePrefix?: string };
  EvaluacionCohorte: { idEval: string; idCohorte: string; titulo: string };
  DocumentoHtml: { title: string; htmlPath: string };
  ForoCurso: { idPrograma: string; nombreProg: string };
};

export type AulaTabParamList = {
  Tablero: undefined;
  Cursos: undefined;
  MisCursos: undefined;
  Presenciales: undefined;
  Puntajes: undefined;
  Certificados: undefined;
  Foro: undefined;
  Perfil: undefined;
};
