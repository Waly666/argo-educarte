/** Página institucional — Fundación Educarte Colombia (objeto social). */
const FUNDACION_LANDING_DEFAULTS = {
  hero: {
    kicker: '🎓 Educación con impacto social',
    titulo: '',
    lead:
      'Promovemos formación, proyectos comunitarios y oportunidades de desarrollo para personas y familias, con énfasis en el Cauca y en quienes más lo necesitan.',
    imagenUrl: '/images/fundacion-equipo.png',
    imagenAlt: 'Equipo de la Fundación Educarte Colombia',
    imagenCaption: 'Trabajo comunitario y formación',
    btnSitioUrl: 'https://educartecolombia.com/',
    btnSitioLabel: 'Sitio institucional ↗',
    btnCursosLabel: 'Ver cursos virtuales',
  },
  quienes: {
    kicker: 'Conócenos',
    titulo: '¿Quiénes somos?',
    lead:
      'Somos la Fundación Educarte Colombia: promovemos educación, cultura y desarrollo comunitario para mejorar la calidad de vida de las personas y las familias, con especial énfasis en el Cauca y en poblaciones vulnerables.',
    destacados: [
      { icon: '📍', label: 'Enfoque territorial', text: 'Cauca y Colombia' },
      { icon: '🇨🇴', label: 'Alcance', text: 'Nacional y comunitario' },
      { icon: '🎓', label: 'Formación', text: 'Presencial, virtual y mixta' },
      { icon: '🤝', label: 'Principios', text: 'Solidaridad e inclusión' },
    ],
    bloques: [
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
    ],
    enlaceUrl: 'https://educartecolombia.com/',
    enlaceLabel: 'Más en nuestro sitio web ↗',
  },
  mision:
    'Promover, diseñar, gestionar, ejecutar y apoyar planes, programas, proyectos y actividades de carácter educativo, social, cultural, ambiental, comunitario, productivo y económico, orientados al mejoramiento de la calidad de vida de las personas, las familias y las comunidades, especialmente de aquellas que se encuentren en condiciones de vulnerabilidad, exclusión, pobreza, riesgo social o con limitadas oportunidades de acceso a la educación, el trabajo, el emprendimiento, la formación ciudadana y el desarrollo humano integral.\n\nDesarrollamos nuestras actividades bajo principios de solidaridad, equidad, inclusión, participación comunitaria, responsabilidad social, sostenibilidad, cultura ciudadana, respeto por la dignidad humana y promoción del bienestar general.',
  vision:
    'Ser referencia en Colombia en educación, cultura y desarrollo comunitario con equidad e inclusión, contribuyendo al bienestar de las comunidades del Cauca y del país mediante programas sostenibles que fortalezcan capacidades, generen oportunidades de empleo y emprendimiento, y promuevan la participación ciudadana y la dignidad humana.',
  compromiso: {
    kicker: '💛 Compromiso social',
    titulo: 'Nuestro compromiso',
    texto:
      'En Fundación Educarte Colombia creemos que la educación y la acción comunitaria transforman vidas. Por eso formulamos e implementamos proyectos que superan barreras de acceso, fortalecen familias y dinamizan territorios.\n\nAcompañamos a niños, niñas, adolescentes, jóvenes, adultos, adultos mayores, mujeres, comunidades rurales, víctimas del conflicto, personas con discapacidad y demás grupos que requieren apoyo social, educativo, económico o comunitario.\n\nGestionamos alianzas con entidades públicas, privadas, instituciones educativas y organismos de cooperación para ampliar el impacto de nuestro objeto social.',
  },
  lineas: {
    kicker: 'Ejes de trabajo',
    titulo: 'Líneas de acción',
    lead: 'Programas alineados con nuestro objeto social y los objetivos específicos de la Fundación.',
    items: [
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
    ],
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
    sedeNota: '',
  },
};

module.exports = { FUNDACION_LANDING_DEFAULTS };
