/** Contenido institucional — Fundación Educarte Colombia (objeto social). */

export const FUNDACION_SITIO_URL = 'https://educartecolombia.com/';

export const FUNDACION_CONTACTO = {
  telefono: '',
  email: 'info@educartecolombia.com',
  direccion: '',
  sedeNota: '',
};

export const FUNDACION_QUIENES_LEAD =
  'Somos la Fundación Educarte Colombia: promovemos educación, cultura y desarrollo comunitario para mejorar la calidad de vida de las personas y las familias, con especial énfasis en el Cauca y en poblaciones vulnerables.';

export const FUNDACION_QUIENES_DESTACADOS = [
  { icon: '📍', label: 'Enfoque territorial', text: 'Cauca y Colombia' },
  { icon: '🇨🇴', label: 'Alcance', text: 'Nacional y comunitario' },
  { icon: '🎓', label: 'Formación', text: 'Presencial, virtual y mixta' },
  { icon: '🤝', label: 'Principios', text: 'Solidaridad e inclusión' },
];

export const FUNDACION_QUIENES_BLOQUES = [
  {
    icon: '💛',
    titulo: 'Fines de beneficencia y utilidad común',
    texto:
      'Persuimos fines educativos, culturales, científicos, sociales y de desarrollo comunitario que contribuyen al mejoramiento de la calidad de vida de la población colombiana.',
  },
  {
    icon: '📚',
    titulo: 'Objeto social integral',
    texto:
      'Diseñamos, gestionamos y ejecutamos planes y programas educativos, sociales, ambientales, productivos y económicos, con énfasis en quienes tienen limitadas oportunidades de acceso a la educación, el trabajo y el emprendimiento.',
  },
  {
    icon: '🌱',
    titulo: 'Cinco ejes de acción',
    texto:
      'Educación y pedagogía, desarrollo social comunitario, emprendimiento sostenible, desarrollo rural agropecuario y gestión de proyectos con entidades públicas, privadas y de cooperación.',
  },
];

export const FUNDACION_MISION = `Promover, diseñar, gestionar, ejecutar y apoyar planes, programas, proyectos y actividades de carácter educativo, social, cultural, ambiental, comunitario, productivo y económico, orientados al mejoramiento de la calidad de vida de las personas, las familias y las comunidades, especialmente de aquellas que se encuentren en condiciones de vulnerabilidad, exclusión, pobreza, riesgo social o con limitadas oportunidades de acceso a la educación, el trabajo, el emprendimiento, la formación ciudadana y el desarrollo humano integral.

Desarrollamos nuestras actividades bajo principios de solidaridad, equidad, inclusión, participación comunitaria, responsabilidad social, sostenibilidad, cultura ciudadana, respeto por la dignidad humana y promoción del bienestar general.`;

export const FUNDACION_VISION = `Ser referencia en Colombia en educación, cultura y desarrollo comunitario con equidad e inclusión, contribuyendo al bienestar de las comunidades del Cauca y del país mediante programas sostenibles que fortalezcan capacidades, generen oportunidades de empleo y emprendimiento, y promuevan la participación ciudadana y la dignidad humana.`;

export const FUNDACION_COMPROMISO = `En Fundación Educarte Colombia creemos que la educación y la acción comunitaria transforman vidas. Por eso formulamos e implementamos proyectos que superan barreras de acceso, fortalecen familias y dinamizan territorios.

Acompañamos a niños, niñas, adolescentes, jóvenes, adultos, adultos mayores, mujeres, comunidades rurales, víctimas del conflicto, personas con discapacidad y demás grupos que requieren apoyo social, educativo, económico o comunitario.

Gestionamos alianzas con entidades públicas, privadas, instituciones educativas y organismos de cooperación para ampliar el impacto de nuestro objeto social.`;

export const FUNDACION_SERVICIOS_DESTACADOS = [
  {
    icon: '🎓',
    title: 'Educación y pedagogía',
    text: 'Formación académica, técnica, tecnológica, TIC, artes, oficios, emprendimiento y educación para el trabajo.',
  },
  {
    icon: '🤝',
    title: 'Desarrollo social comunitario',
    text: 'Proyectos de inclusión, bienestar, recreación, cultura, salud preventiva y participación ciudadana.',
  },
  {
    icon: '💼',
    title: 'Emprendimiento y economía solidaria',
    text: 'Incubación de proyectos productivos, empleabilidad, asistencia técnica y fortalecimiento de unidades de negocio.',
  },
  {
    icon: '🌾',
    title: 'Desarrollo rural y agropecuario',
    text: 'Capacitación en BPA, BPG, agroecología, asociatividad campesina, seguridad alimentaria y adaptación climática.',
  },
];

export const FUNDACION_LANDING_DEFAULTS = {
  hero: {
    kicker: '🎓 Educación con impacto social',
    titulo: '',
    lead:
      'Promovemos formación, proyectos comunitarios y oportunidades de desarrollo para personas y familias, con énfasis en el Cauca y en quienes más lo necesitan.',
    imagenUrl: '',
    imagenAlt: 'Equipo de la Fundación Educarte Colombia',
    imagenCaption: 'Trabajo comunitario y formación',
    btnSitioUrl: FUNDACION_SITIO_URL,
    btnSitioLabel: 'Sitio institucional ↗',
    btnCursosLabel: 'Ver cursos virtuales',
  },
  quienes: {
    kicker: 'Conócenos',
    titulo: '¿Quiénes somos?',
    lead: FUNDACION_QUIENES_LEAD,
    destacados: [...FUNDACION_QUIENES_DESTACADOS],
    bloques: FUNDACION_QUIENES_BLOQUES.map((b) => ({ ...b })),
    enlaceUrl: FUNDACION_SITIO_URL,
    enlaceLabel: 'Más en nuestro sitio web ↗',
  },
  mision: FUNDACION_MISION,
  vision: FUNDACION_VISION,
  compromiso: {
    kicker: '💛 Compromiso social',
    titulo: 'Nuestro compromiso',
    texto: FUNDACION_COMPROMISO,
  },
  lineas: {
    kicker: 'Ejes de trabajo',
    titulo: 'Líneas de acción',
    lead: 'Programas alineados con nuestro objeto social y los objetivos específicos de la Fundación.',
    items: [...FUNDACION_SERVICIOS_DESTACADOS],
  },
  cta: {
    kicker: '🎓 Formación para todos',
    titulo: '¡Empiece su proceso formativo!',
    texto:
      'Explore cursos virtuales, programe su matrícula y acceda al aula digital de Fundación Educarte Colombia.',
    btnRegistro: 'Crear cuenta',
    btnServicios: 'Conocer nuestros ejes',
  },
  contacto: {
    kicker: '📍 Escríbenos',
    titulo: 'Hablemos',
    lead: 'Con gusto le orientamos sobre programas, proyectos y alianzas.',
    sedeNota: FUNDACION_CONTACTO.sedeNota,
  },
};
