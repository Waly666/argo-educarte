const { FUNDACION_LANDING_DEFAULTS } = require('./aulaVirtualFundacionDefaults');

/** Contenido editable del landing del portal aula virtual (valores por defecto). */
const LANDING_DEFAULTS = {
  instBarTag: 'Educación, cultura y desarrollo comunitario en Colombia',
  quoteText:
    'Solidaridad, inclusión y educación de calidad para construir futuro en las comunidades colombianas.',
  quoteLabel: 'O contáctanos',
  metaDescription:
    'Fundación Educarte Colombia: educación, cultura y desarrollo comunitario. Cursos virtuales, formación técnica, proyectos sociales y aula virtual con impacto en el Cauca y el país.',
  metaKeywords:
    'Educarte Colombia, Fundación Educarte Colombia, educación comunitaria Cauca, aula virtual Colombia, cursos virtuales Cauca, formación técnica Colombia, desarrollo comunitario, emprendimiento social, proyectos sociales Colombia, formación rural agropecuaria, educación población vulnerable, fundación sin ánimo de lucro Cauca',
  hero: {
    ctaPrincipal: 'Ver cursos y programas',
    ctaSecundario: 'Crear cuenta gratis',
    mostrarBotonLlamar: true,
    imagenAlt: 'Participante en programas de formación de Educarte Colombia',
  },
  infoCards: [
    { icon: '🎓', title: 'Capacitación', text: 'Certificamos con calidad', fuente: 'texto' },
    { icon: '📞', title: 'Línea de atención', text: '', fuente: 'telefono' },
    { icon: '📍', title: 'Dirección', text: '', fuente: 'direccion' },
  ],
  nav: {
    home: 'Home',
    tienda: 'Tienda',
    cursos: 'Cursos',
    aula: 'Aula virtual',
    acerca: 'Acerca de',
    fundacion: 'Quiénes somos',
    consultaCertificados: 'Certificados',
    blog: 'Blog',
    acceder: 'Acceder',
    registrarse: 'Registrarse',
    salir: 'Salir',
  },
  footer: {
    founded: 'Est. 2025',
    copyright: 'Copyright © 2026 Fundación Educarte Colombia. Todos los derechos reservados.',
    tituloEnlaces: 'Enlaces rápidos',
    tituloServicios: 'Servicios',
    tituloContacto: 'Contáctanos',
  },
  catalogo: {
    tituloCursos: 'Catálogo de cursos y programas',
    tituloTienda: 'Tienda de formación',
    leadCursos: 'Explore cursos y programas de Fundación Educarte Colombia disponibles en el aula virtual.',
    leadTienda: 'Inscríbase a cursos y programas de formación con impacto social y comunitario.',
    placeholderBuscar: 'Buscar curso o programa…',
  },
  ofertas: {
    titulo: '¿Qué ofrecemos?',
    lead: 'Educación, formación técnica y proyectos sociales para personas, familias y comunidades.',
    items: [
      {
        icon: '💻',
        title: 'Formación virtual y aula digital',
        text: 'Cursos y programas en línea para estudiar a su ritmo, con acceso desde cualquier lugar y acompañamiento pedagógico.',
      },
      {
        icon: '🎓',
        title: 'Educación técnica y para el trabajo',
        text: 'Programas de formación académica, técnica, tecnológica e informal orientados al desarrollo humano integral.',
      },
      {
        icon: '🤝',
        title: 'Proyectos sociales y comunitarios',
        text: 'Iniciativas de inclusión, participación ciudadana y bienestar para familias y comunidades vulnerables.',
      },
    ],
  },
  beneficios: {
    kicker: 'Impacto',
    titulo: 'Lo que logra con nuestros programas',
    lead: 'Formación práctica, inclusión y flexibilidad para avanzar sin dejar de lado su vida diaria.',
    items: [
      {
        icon: '✅',
        title: 'Formación con propósito social',
        text: 'Programas diseñados para fortalecer capacidades, empleabilidad, emprendimiento y participación comunitaria.',
      },
      {
        icon: '📱',
        title: 'Aprenda donde esté',
        text: 'Acceda al aula virtual desde computador, tableta o celular, sin horarios rígidos.',
      },
      {
        icon: '📈',
        title: 'Avance a su ritmo',
        text: 'Retome su proceso, consulte su progreso y continúe la formación con flexibilidad.',
      },
    ],
  },
  servicios: {
    titulo: 'Nuestros ejes de trabajo',
    items: [
      { icon: '🎓', title: 'Desarrollo educativo y pedagógico', url: '' },
      { icon: '🤝', title: 'Desarrollo social y comunitario', url: '' },
      { icon: '💼', title: 'Emprendimiento y economía solidaria', url: '' },
      { icon: '🌾', title: 'Desarrollo rural y agropecuario', url: '' },
      { icon: '🛣️', title: 'Capacitación en seguridad vial y movilidad', url: '' },
      { icon: '🔬', title: 'Investigación, foros y eventos académicos', url: '' },
      { icon: '📱', title: 'Alfabetización digital y TIC', url: '' },
      { icon: '🌱', title: 'Gestión ambiental y sostenibilidad', url: '' },
    ],
  },
  valores: {
    titulo: 'Nuestros principios',
    lead: 'Actuamos con solidaridad, equidad e inclusión en cada programa y proyecto.',
    items: [
      {
        title: 'Solidaridad y equidad',
        text: 'Priorizamos a quienes tienen limitadas oportunidades de acceso a la educación, el trabajo y el emprendimiento.',
      },
      {
        title: 'Participación comunitaria',
        text: 'Las comunidades son protagonistas de los procesos que diseñamos y ejecutamos junto a ellas.',
      },
      {
        title: 'Educación de calidad',
        text: 'Promovemos formación académica, técnica, cultural y ciudadana para el desarrollo humano integral.',
      },
      {
        title: 'Responsabilidad social',
        text: 'Trabajamos con ética, transparencia y compromiso con el bienestar de las personas y el territorio.',
      },
      {
        title: 'Sostenibilidad',
        text: 'Impulsamos proyectos productivos, ambientales y comunitarios con visión de largo plazo.',
      },
      {
        title: 'Dignidad humana',
        text: 'Respetamos y promovemos los derechos, la convivencia y la formación ciudadana.',
      },
    ],
  },
  testimonios: {
    kicker: 'Voces',
    titulo: 'Experiencias de nuestra comunidad',
    lead: 'Personas y líderes comunitarios que han participado en nuestros programas.',
    items: [
      {
        nombre: 'Ana Lucía M.',
        rol: 'Beneficiaria — formación comunitaria',
        texto:
          'La Fundación me abrió la puerta a estudiar sin dejar de cuidar mi hogar. Los contenidos son claros y el acompañamiento humano marca la diferencia.',
      },
      {
        nombre: 'Jhon Freddy P.',
        rol: 'Emprendedor rural',
        texto:
          'Encontré capacitación en emprendimiento y buenas prácticas productivas. Hoy aplico lo aprendido con mi familia y mi comunidad.',
      },
      {
        nombre: 'María Elena R.',
        rol: 'Líder comunitaria — Cauca',
        texto:
          'Los programas sociales y educativos de Educarte fortalecen a nuestras familias. La formación llega a quienes más lo necesitan.',
      },
    ],
  },
  pasos: {
    kicker: 'Empiece hoy',
    titulo: 'Cómo acceder a la formación',
    lead: 'Tres pasos para matricularse en el aula virtual y comenzar su proceso.',
    items: [
      {
        paso: '1',
        title: 'Explore el catálogo',
        text: 'Revise los cursos y programas publicados y elija el que se ajuste a sus metas.',
      },
      {
        paso: '2',
        title: 'Regístrese e inscríbase',
        text: 'Cree su cuenta, matricúlese al programa y reciba acceso al aula virtual.',
      },
      {
        paso: '3',
        title: 'Forme y certifíquese',
        text: 'Complete el contenido, cumpla los requisitos y obtenga su certificación cuando corresponda.',
      },
    ],
  },
  faq: {
    kicker: 'Ayuda',
    titulo: 'Preguntas frecuentes',
    lead: 'Resolvemos las dudas más comunes sobre la Fundación y el aula virtual.',
    contactoTexto: '¿Aún tiene dudas sobre un curso o programa?',
    items: [
      {
        pregunta: '¿Qué es la Fundación Educarte Colombia?',
        respuesta:
          'Es una entidad sin ánimo de lucro que promueve programas educativos, sociales, culturales y comunitarios para mejorar la calidad de vida de las personas y las familias, con énfasis en poblaciones vulnerables y el departamento del Cauca.',
      },
      {
        pregunta: '¿Qué puedo estudiar en el aula virtual?',
        respuesta:
          'En el catálogo encontrará cursos y programas de formación académica, técnica, ciudadana, emprendimiento, TIC, seguridad vial, desarrollo comunitario y otras áreas de nuestro objeto social.',
      },
      {
        pregunta: '¿Necesito pagar antes de empezar?',
        respuesta:
          'Depende de cada curso o programa. La ficha de matrícula indica si el acceso es gratuito, requiere pago previo o permite estudiar y pagar al certificar.',
      },
      {
        pregunta: '¿Puedo estudiar desde el celular?',
        respuesta: 'Sí. El aula virtual funciona en computador, tableta y móvil con conexión a internet.',
      },
      {
        pregunta: '¿Cómo me inscribo?',
        respuesta:
          'Regístrese en el portal, elija el curso o programa en el catálogo y pulse «Matricularme».',
      },
    ],
  },
  cursos: {
    kicker: 'Catálogo en línea',
    titulo: 'Cursos y programas disponibles',
    emptyTitulo: 'Próximamente nuevos programas',
    emptyTexto: 'Estamos publicando más cursos y programas de formación. Vuelva pronto o contáctenos.',
  },
  carreras: {
    kicker: 'Programas formativos',
    titulo: 'Líneas de formación',
    lead: 'Rutas de aprendizaje alineadas con nuestros ejes educativos, sociales y productivos.',
    items: [
      {
        titulo: 'Formación académica, técnica y tecnológica',
        cno: '—',
        horas: 480,
        semestres: 2,
        jornadas: 'Virtual, presencial y mixta',
      },
      {
        titulo: 'Educación para el trabajo y desarrollo humano',
        cno: '—',
        horas: 360,
        semestres: 2,
        jornadas: 'Virtual y fines de semana',
      },
      {
        titulo: 'Emprendimiento, empleabilidad y economía solidaria',
        cno: '—',
        horas: 120,
        semestres: 1,
        jornadas: 'Virtual',
      },
      {
        titulo: 'Formación rural, agropecuaria y agroecología',
        cno: '—',
        horas: 200,
        semestres: 1,
        jornadas: 'Presencial y virtual',
      },
    ],
  },
  appMobile: {
    kicker: 'App Mobile',
    titulo: 'Lleve el aula virtual en su bolsillo',
    lead:
      'Acceda a sus cursos, consulte certificados y manténgase al día desde su celular con la app oficial de la institución.',
    features: [
      {
        icon: '📚',
        title: 'Cursos y programas',
        text: 'Ingrese al aula virtual y retome su formación donde la dejó.',
      },
      {
        icon: '🎓',
        title: 'Certificados',
        text: 'Consulte y verifique sus certificados expedidos en línea.',
      },
      {
        icon: '🔔',
        title: 'Siempre conectado',
        text: 'Experiencia optimizada para Android, rápida y fácil de usar.',
      },
    ],
    btnDescargar: 'Descargar APK para Android',
    notaInstalacion: 'Android 8.0 o superior · Instalación manual del archivo APK',
    apkUrl: '/apk/aula-virtual-educarte.apk',
    apkNombre: 'aula-virtual-educarte.apk',
  },
  blog: {
    kicker: 'Blog',
    titulo: 'Noticias y artículos',
    lead: 'Novedades sobre educación, proyectos sociales, emprendimiento y desarrollo comunitario.',
    emptyTitulo: 'Próximamente publicaremos artículos',
    emptyTexto: 'Vuelva pronto para leer las últimas noticias de Educarte Colombia.',
  },
  pilares: {
    tabCapacitacion: 'Educación y formación',
    tabCampanas: 'Comunidad y proyectos',
    capacitacion: [
      'Diseñamos e implementamos programas de formación académica, técnica, tecnológica e informal.',
      'Promovemos capacitación en competencias ciudadanas, artes, oficios, TIC, emprendimiento y seguridad vial.',
      'Celebramos alianzas con instituciones educativas para ampliar becas e incentivos a estudiantes de escasos recursos.',
    ],
    campanas: [
      'Ejecutamos proyectos sociales para infancia, juventud, adulto mayor, víctimas del conflicto y poblaciones vulnerables.',
      'Desarrollamos jornadas, talleres, ferias y campañas de educación, cultura, salud preventiva, ambiente y participación ciudadana.',
    ],
  },
  footerServicios: [
    'Educación y pedagogía',
    'Desarrollo social comunitario',
    'Emprendimiento',
    'Formación rural',
    'Seguridad vial y movilidad',
    'Alfabetización digital',
  ],
  fundacion: JSON.parse(JSON.stringify(FUNDACION_LANDING_DEFAULTS)),
};

;

module.exports = { LANDING_DEFAULTS };
