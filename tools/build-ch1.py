#!/usr/bin/env python3
"""Authoring helper for data/ch1.json (lessons, drills, dialogues, extra vocab). Run: python3 tools/build-ch1.py"""
import json
from pathlib import Path

drills, lessons = [], []

def D(lesson, n, type_, prompt, answer, explain, full, hint=None, options=None):
    d = {"id": f"d-{lesson}-{n}", "type": type_, "prompt": prompt}
    if hint: d["hint"] = hint
    if options: d["options"] = options
    d.update(answer=answer if isinstance(answer, list) else [answer], explain=explain,
             full={"id": f"d-{lesson}-{n}-f", "es": full})
    drills.append(d)
    return d["id"]

def L(id_, title, summary, cards, drill_ids, dialogue=None):
    l = {"id": f"l-{id_}", "title": title, "summary": summary, "cards": cards, "drills": drill_ids}
    if dialogue: l["dialogue"] = dialogue
    lessons.append(l)

def ex(id_, es, en): return {"id": f"s-{id_}", "es": es, "en": en}

# ---- 1 sounds & accents
n = [0]
def d1(*a, **k): n[0] += 1; return D("sounds", n[0], *a, **k)
L("sounds", "Sounds, stress and accent marks", "Spanish is spelled as it sounds. Learn the rules once.", [
  {"rule": "Five pure vowels: **a e i o u**, always short and clear. **H** is silent. **J** and **g** (before e/i) sound like a rough *h*. **Ñ** sounds like *ny*. **V** sounds like **b**.",
   "examples": [ex("hola-ahora", "Hola, ¿cómo estás ahora?", "Hi, how are you now?"), ex("jamon-gente", "El jamón y la gente.", "The ham and the people."), ex("espanol", "Hablo español.", "I speak Spanish.")],
   "note": "In Spain, **c** before e/i and **z** sound like *th* (cena, zumo). In Latin America they sound like *s*."},
  {"rule": "Stress: a word ending in a **vowel, n or s** is stressed on the second-to-last syllable (**ha**-bla, **ca**-sa). Any other consonant: stress the last syllable (ha-**blar**, ciu-**dad**). An **accent mark** shows an exception (can-**ción**).",
   "examples": [ex("hablan", "Ellos hablan despacio.", "They speak slowly."), ex("ciudad", "La ciudad es grande.", "The city is big."), ex("cancion", "Me gusta esta canción.", "I like this song.")]},
  {"rule": "An accent mark can also tell two words apart: **tú** (you) / **tu** (your), **él** (he) / **el** (the), **sí** (yes) / **si** (if), **más** (more), **cómo** (how).",
   "examples": [ex("tu-tu", "Tú tienes tu libro.", "You have your book."), ex("el-el", "Él es el hermano de Ana.", "He is Ana's brother.")],
   "trap": "Question words always carry an accent: **¿Cómo? ¿Qué? ¿Dónde? ¿Cuándo?**"}],
  [d1("choose", "___ tienes mi libro.", "Tú", "Tú = you (subject). Tu = your.", "Tú tienes mi libro.", options=["Tu", "Tú"]),
   d1("choose", "¿Quieres café? —___, gracias.", "Sí", "Sí with accent = yes. Si = if.", "¿Quieres café? Sí, gracias.", options=["Si", "Sí"]),
   d1("choose", "___ es mi hermano.", "Él", "Él = he. El = the.", "Él es mi hermano.", options=["El", "Él"]),
   d1("choose", "Quiero ___ café.", "más", "Más = more, with accent.", "Quiero más café.", options=["mas", "más"]),
   d1("choose", "¿___ estás?", "Cómo", "Question words take an accent.", "¿Cómo estás?", options=["Como", "Cómo"]),
   d1("choose", "Es ___ casa.", "tu", "Tu = your (before a noun), no accent.", "Es tu casa.", options=["tu", "tú"])])

# ---- 2 gender & articles
n[0] = 0
def d2(*a, **k): n[0] += 1; return D("gender", n[0], *a, **k)
L("gender", "Gender and articles", "Every noun is masculine or feminine. Learn the article with the word.", [
  {"rule": "Every noun is **masculine** or **feminine**. Words ending in **-o** are usually masculine (**el** libro), words in **-a** usually feminine (**la** casa). Plural: **los** / **las**.",
   "examples": [ex("el-libro", "El libro es nuevo.", "The book is new."), ex("la-casa", "La casa es grande.", "The house is big."), ex("los-amigos", "Los amigos están aquí.", "The friends are here.")]},
  {"rule": "Endings **-ción, -sión, -dad** are feminine; **-or** is masculine. Exceptions to learn: **el día**, **el mapa**, **la mano**. Feminine nouns **beginning with a stressed a** use *el*: **el agua**.",
   "examples": [ex("la-ciudad", "La ciudad es bonita.", "The city is pretty."), ex("el-dia", "Hoy es un buen día.", "Today is a good day."), ex("el-agua", "El agua está fría.", "The water is cold.")],
   "trap": "Learn the article with every noun: **la mano**, not just *mano*."},
  {"rule": "\"A / some\": **un** (m), **una** (f), **unos** (m pl), **unas** (f pl).",
   "examples": [ex("un-hermano", "Tengo un hermano.", "I have a brother."), ex("una-hermana", "Tengo una hermana.", "I have a sister."), ex("unos-libros", "Hay unos libros en la mesa.", "There are some books on the table.")]}],
  [d2("gap", "___ casa es grande.", "la", "Casa ends in -a: feminine.", "La casa es grande.", hint="the"),
   d2("gap", "___ libro es nuevo.", "el", "Libro ends in -o: masculine.", "El libro es nuevo.", hint="the"),
   d2("gap", "___ ciudad es bonita.", "la", "-dad nouns are feminine.", "La ciudad es bonita.", hint="the"),
   d2("gap", "___ día es bonito.", "el", "Día is a masculine exception.", "El día es bonito.", hint="the"),
   d2("gap", "___ amigas están aquí.", "las", "Feminine plural: las.", "Las amigas están aquí.", hint="the (f pl)"),
   d2("choose", "Tengo ___ hermana.", "una", "Hermana is feminine singular.", "Tengo una hermana.", options=["un", "una"]),
   d2("choose", "Hay ___ libros en la mesa.", "unos", "Libros is masculine plural.", "Hay unos libros en la mesa.", options=["unos", "unas"]),
   d2("translate", "I have a brother.", ["Tengo un hermano.", "Yo tengo un hermano."], "Tener + un (masculine).", "Tengo un hermano.")])

# ---- 3 plurals & adjectives
n[0] = 0
def d3(*a, **k): n[0] += 1; return D("adjectives", n[0], *a, **k)
L("adjectives", "Plurals and adjectives", "Adjectives agree with the noun and follow it.", [
  {"rule": "Plurals: vowel + **-s** (casa → casas); consonant + **-es** (ciudad → ciudades); **-z** → **-ces** (lápiz → lápices).",
   "examples": [ex("casas", "Las casas son bonitas.", "The houses are pretty."), ex("ciudades", "Hay dos ciudades grandes.", "There are two big cities."), ex("lapices", "Tengo tres lápices.", "I have three pencils.")]},
  {"rule": "Adjectives **agree** in gender and number and usually come **after** the noun: **un coche rojo, una casa roja, unos coches rojos**. Adjectives in **-e** or most consonants don't change for gender (grande, azul), except nationalities: **holandés / holandesa**.",
   "examples": [ex("coche-rojo", "Tengo un coche rojo.", "I have a red car."), ex("casa-roja", "Tengo una casa roja.", "I have a red house."), ex("mujer-inteligente", "Ella es una mujer inteligente.", "She is an intelligent woman.")],
   "trap": "Not *una blanca casa*: the adjective follows the noun."}],
  [d3("gap", "Los libros son ___.", "nuevos", "Masculine plural: nuevo → nuevos.", "Los libros son nuevos.", hint="nuevo"),
   d3("gap", "La casa es ___.", "blanca", "Feminine singular: blanco → blanca.", "La casa es blanca.", hint="blanco"),
   d3("gap", "Las ciudades son ___.", "grandes", "Grande only adds -s in the plural.", "Las ciudades son grandes.", hint="grande"),
   d3("gap", "Una ciudad, dos ___.", "ciudades", "Ends in a consonant: add -es.", "Una ciudad, dos ciudades.", hint="ciudad"),
   d3("choose", "Tengo un coche ___.", "rojo", "Coche is masculine.", "Tengo un coche rojo.", options=["rojo", "roja"]),
   d3("choose", "Tengo una casa ___.", "pequeña", "Casa is feminine.", "Tengo una casa pequeña.", options=["pequeño", "pequeña"]),
   d3("build", "I have a red car.", ["Tengo un coche rojo."], "Adjective after the noun.", "Tengo un coche rojo."),
   d3("translate", "the big cities", ["las ciudades grandes", "las grandes ciudades"], "Feminine plural agreement.", "Las ciudades grandes.")])

# ---- 4 present tense
n[0] = 0
def d4(*a, **k): n[0] += 1; return D("present", n[0], *a, **k)
L("present", "Present tense and tú / usted", "Regular verbs: drop -ar/-er/-ir and add the endings.", [
  {"rule": "Drop **-ar / -er / -ir**, add endings. **-ar**: -o, -as, -a, -amos, -áis, -an. **-er**: -o, -es, -e, -emos, -éis, -en. **-ir**: -o, -es, -e, -imos, -ís, -en.",
   "examples": [ex("hablo", "Hablo español.", "I speak Spanish."), ex("comemos", "Comemos a las dos.", "We eat at two."), ex("viven", "Ellos viven en Madrid.", "They live in Madrid.")],
   "trap": "Skip the pronoun: *Hablo español*, not *Yo hablo español* (unless you contrast)."},
  {"rule": "**tú** is informal (friends, family, peers). **usted** is formal (strangers, older people) and uses the **he/she** verb form. Plural *you*: **vosotros** (informal, Spain) / **ustedes**.",
   "examples": [ex("como-estas", "¿Cómo estás, Ana?", "How are you, Ana?"), ex("como-esta-usted", "¿Cómo está usted, señora?", "How are you, madam?"), ex("vive-usted", "¿Vive usted aquí?", "Do you live here?")],
   "note": "In Latin America *vosotros* isn't used: everyone says *ustedes*."}],
  [d4("gap", "Yo ___ español.", "hablo", "Yo form of hablar: -o.", "Yo hablo español.", hint="hablar"),
   d4("gap", "Tú ___ mucho.", "comes", "Tú form of comer: -es.", "Tú comes mucho.", hint="comer"),
   d4("gap", "Ella ___ en Madrid.", "vive", "Ella form of vivir: -e.", "Ella vive en Madrid.", hint="vivir"),
   d4("gap", "Nosotros ___ aquí.", "trabajamos", "Nosotros form: -amos.", "Nosotros trabajamos aquí.", hint="trabajar"),
   d4("gap", "Ellos ___ agua.", "beben", "Ellos form of beber: -en.", "Ellos beben agua.", hint="beber"),
   d4("choose", "Señora López, ¿___ habla inglés?", "usted", "Formal address: usted.", "Señora López, ¿usted habla inglés?", options=["tú", "usted"]),
   d4("translate", "I don't speak English.", ["No hablo inglés.", "Yo no hablo inglés."], "No goes before the verb.", "No hablo inglés."),
   d4("translate", "We live here.", ["Vivimos aquí.", "Nosotros vivimos aquí.", "Nosotras vivimos aquí."], "Nosotros form of vivir: -imos.", "Vivimos aquí.")], "dlg-meeting")

# ---- 5 ser / estar
n[0] = 0
def d5(*a, **k): n[0] += 1; return D("ser-estar", n[0], *a, **k)
L("ser-estar", "ser vs estar", "Two verbs for \"to be\".", [
  {"rule": "**ser** = what something *is*: identity, origin, profession, characteristics, time. **soy, eres, es, somos, sois, son**.",
   "examples": [ex("soy-holandes", "Soy holandés.", "I am Dutch."), ex("mi-madre-medica", "Mi madre es médica.", "My mother is a doctor."), ex("son-las-tres", "Son las tres.", "It is three o'clock.")]},
  {"rule": "**estar** = how or where something *is*: location and temporary state. **estoy, estás, está, estamos, estáis, están**.",
   "examples": [ex("madrid-esta", "Madrid está en España.", "Madrid is in Spain."), ex("estoy-cansado", "Estoy cansado.", "I am tired."), ex("cafe-frio", "El café está frío.", "The coffee is cold.")],
   "trap": "*Ser aburrido* = to be boring, *estar aburrido* = to be bored. Same adjective, different meaning."}],
  [d5("gap", "Yo ___ holandés.", "soy", "Identity or origin: ser.", "Yo soy holandés.", hint="ser"),
   d5("gap", "Nosotros ___ en casa.", "estamos", "Location: estar.", "Nosotros estamos en casa.", hint="estar"),
   d5("gap", "Ellos ___ cansados.", "están", "Temporary state: estar.", "Ellos están cansados.", hint="estar"),
   d5("choose", "La fiesta ___ el sábado.", "es", "Events and dates use ser.", "La fiesta es el sábado.", options=["es", "está"]),
   d5("choose", "Madrid ___ en España.", "está", "Location: estar.", "Madrid está en España.", options=["es", "está"]),
   d5("choose", "Mi madre ___ médica.", "es", "Profession: ser.", "Mi madre es médica.", options=["es", "está"]),
   d5("choose", "Hoy ___ cansado.", "estoy", "Temporary state: estar.", "Hoy estoy cansado.", options=["soy", "estoy"]),
   d5("translate", "I am tired.", ["Estoy cansado.", "Estoy cansada.", "Yo estoy cansado.", "Yo estoy cansada."], "Temporary state; cansado/a by gender.", "Estoy cansado."),
   d5("translate", "Where are you from?", ["¿De dónde eres?", "¿De dónde eres tú?", "¿De dónde es usted?", "¿De dónde sois?"], "Origin: ser + de.", "¿De dónde eres?")])

# ---- 6 tener & hay
n[0] = 0
def d6(*a, **k): n[0] += 1; return D("tener-hay", n[0], *a, **k)
L("tener-hay", "tener and hay", "Having, ages, feelings, and \"there is / there are\".", [
  {"rule": "**tengo, tienes, tiene, tenemos, tenéis, tienen.** Spanish uses *tener* for age and feelings: **tengo 30 años, tengo hambre / sed / frío / calor / sueño**. **tener que** + infinitive = must.",
   "examples": [ex("tengo-anos", "Tengo treinta años.", "I am thirty years old."), ex("tenemos-frio", "Tenemos frío.", "We are cold."), ex("tienen-que", "Tienen que trabajar.", "They have to work.")],
   "trap": "Never *Soy hambriento*: hunger, thirst and age are things you *have*."},
  {"rule": "**hay** = there is / there are (one form for both). Use **hay** for something new, **está / están** for something already known.",
   "examples": [ex("hay-banco", "Hay un banco cerca.", "There is a bank nearby."), ex("donde-esta-banco", "¿Dónde está el banco?", "Where is the bank?"), ex("no-hay-problema", "No hay problema.", "No problem.")]}],
  [d6("gap", "Yo ___ hambre.", "tengo", "Hunger: tener.", "Yo tengo hambre.", hint="tener"),
   d6("gap", "Ella ___ veinticinco años.", "tiene", "Age: tener.", "Ella tiene veinticinco años.", hint="tener"),
   d6("gap", "Nosotros ___ frío.", "tenemos", "Feeling cold: tener.", "Nosotros tenemos frío.", hint="tener"),
   d6("gap", "Ellos ___ que trabajar.", "tienen", "Tener que = must.", "Ellos tienen que trabajar.", hint="tener"),
   d6("choose", "___ un banco cerca.", "Hay", "Introducing something new: hay.", "Hay un banco cerca.", options=["Hay", "Está"]),
   d6("choose", "¿Dónde ___ el banco?", "está", "Asking where a known thing is: estar.", "¿Dónde está el banco?", options=["hay", "está"]),
   d6("choose", "En la mesa ___ tres libros.", "hay", "New items: hay.", "En la mesa hay tres libros.", options=["hay", "están"]),
   d6("translate", "I am thirsty.", ["Tengo sed.", "Yo tengo sed."], "Thirst: tener.", "Tengo sed."),
   d6("translate", "There is no problem.", ["No hay problema."], "No + hay.", "No hay problema.")])

# ---- 7 negation & questions
n[0] = 0
def d7(*a, **k): n[0] += 1; return D("questions", n[0], *a, **k)
L("questions", "Negation and questions", "Put no before the verb. Question words always take an accent.", [
  {"rule": "Negative: **no** before the verb. Double negatives are correct: **No tengo nada. No hablo con nadie.** Yes/no question: same words, raised voice, and **¿ ?**.",
   "examples": [ex("no-hablo", "No hablo inglés.", "I don't speak English."), ex("no-tengo-nada", "No tengo nada.", "I have nothing."), ex("hablas-espanol", "¿Hablas español?", "Do you speak Spanish?")]},
  {"rule": "**¿qué?** what · **¿quién?** who · **¿dónde?** where · **¿cuándo?** when · **¿cómo?** how · **¿por qué?** why (**porque** = because) · **¿cuánto?** how much · **¿cuál?** which.",
   "examples": [ex("como-te-llamas", "¿Cómo te llamas?", "What's your name?"), ex("donde-esta-bano", "¿Dónde está el baño?", "Where is the bathroom?"), ex("cuanto-cuesta", "¿Cuánto cuesta?", "How much does it cost?")]}],
  [d7("gap", "¿___ te llamas?", "Cómo", "How are you called = what's your name.", "¿Cómo te llamas?", hint="how"),
   d7("gap", "¿___ está el baño?", "Dónde", "Where: dónde.", "¿Dónde está el baño?", hint="where"),
   d7("gap", "¿___ cuesta?", "Cuánto", "How much: cuánto.", "¿Cuánto cuesta?", hint="how much"),
   d7("choose", "¿___ estudias español?", "Por qué", "Two words, accent on qué, for why.", "¿Por qué estudias español?", options=["Por qué", "Porque"]),
   d7("choose", "No tengo ___.", "nada", "Double negative: no ... nada.", "No tengo nada.", options=["nada", "algo"]),
   d7("build", "I do not speak English well.", ["No hablo bien inglés."], "No before the verb; bien after it.", "No hablo bien inglés."),
   d7("build", "Where is the bathroom?", ["¿Dónde está el baño?"], "Question word first, then verb.", "¿Dónde está el baño?"),
   d7("translate", "How much does it cost?", ["¿Cuánto cuesta?", "¿Cuánto vale?"], "Cuánto + cuesta (or vale).", "¿Cuánto cuesta?")])

# ---- 8 numbers & time
n[0] = 0
def d8(*a, **k): n[0] += 1; return D("numbers-time", n[0], *a, **k)
L("numbers-time", "Numbers, time and days", "Count to 100, tell the time, name the days.", [
  {"rule": "**11** once · **12** doce · **15** quince · **16** dieciséis · **20** veinte · **21** veintiuno · **30** treinta · **40** cuarenta · **50** cincuenta · **100** cien. From 31 up: tens + **y** + unit, as separate words (treinta y uno).",
   "examples": [ex("tengo-treinta", "Tengo treinta años.", "I am thirty."), ex("cuarenta-y-cinco", "Son cuarenta y cinco euros.", "That's forty-five euros."), ex("veintiun", "Tengo veintiún años.", "I am twenty-one.")],
   "note": "**uno** becomes **un** before a masculine noun: *un euro*, *veintiún años*."},
  {"rule": "Time: **Es la una.** / **Son las dos, las tres...** Then **y cuarto**, **y media**, **menos cuarto**. Days are lowercase: lunes, martes, miércoles, jueves, viernes, sábado, domingo.",
   "examples": [ex("es-la-una", "Es la una.", "It's one o'clock."), ex("tres-y-media", "Son las tres y media.", "It's half past three."), ex("ocho-menos-cuarto", "Son las ocho menos cuarto.", "It's a quarter to eight.")]}],
  [d8("gap", "Tengo ___ años. (30)", "treinta", "30 = treinta.", "Tengo treinta años.", hint="30"),
   d8("gap", "Son las ___ y media. (3)", "tres", "3 = tres.", "Son las tres y media.", hint="3"),
   d8("gap", "Dos más tres son ___.", "cinco", "2 + 3 = cinco.", "Dos más tres son cinco.", hint="5"),
   d8("gap", "Cuarenta y ___. (45)", "cinco", "45 = cuarenta y cinco.", "Cuarenta y cinco.", hint="5"),
   d8("gap", "El día después del lunes es el ___.", "martes", "Monday, Tuesday: lunes, martes.", "El día después del lunes es el martes."),
   d8("choose", "___ la una.", "Es", "Singular hour (one o'clock): es.", "Es la una.", options=["Es", "Son"]),
   d8("choose", "___ las tres.", "Son", "Plural hours: son.", "Son las tres.", options=["Es", "Son"]),
   d8("build", "It is a quarter to eight.", ["Son las ocho menos cuarto."], "Hour, then menos cuarto.", "Son las ocho menos cuarto."),
   d8("translate", "It is half past four.", ["Son las cuatro y media."], "Y media = half past.", "Son las cuatro y media.")])

# ---- 9 gustar
n[0] = 0
def d9(*a, **k): n[0] += 1; return D("gustar", n[0], *a, **k)
L("gustar", "gustar: liking things", "The thing you like is the subject; the verb agrees with it.", [
  {"rule": "Literally \"it is pleasing to me\". **me, te, le, nos, os, les** + **gusta** (one thing or a verb) / **gustan** (several things).",
   "examples": [ex("me-gusta-cafe", "Me gusta el café.", "I like coffee."), ex("me-gustan-gatos", "Me gustan los gatos.", "I like cats."), ex("te-gusta-bailar", "¿Te gusta bailar?", "Do you like dancing?")],
   "trap": "Not *Yo gusto el café*. The thing liked is the subject."},
  {"rule": "Negative: **no** goes first. Similar verbs: **encantar** (love), **interesar**. **No me gusta la sopa. Me encanta el chocolate.**",
   "examples": [ex("no-nos-gusta-sopa", "No nos gusta la sopa.", "We don't like soup."), ex("le-gusta-ciudad", "A ella le gusta la ciudad.", "She likes the city.")]}],
  [d9("choose", "Me ___ el café.", "gusta", "One thing: gusta.", "Me gusta el café.", options=["gusta", "gustan"]),
   d9("choose", "Me ___ los gatos.", "gustan", "Several things: gustan.", "Me gustan los gatos.", options=["gusta", "gustan"]),
   d9("choose", "No ___ gusta la sopa. (we)", "nos", "Nos = to us.", "No nos gusta la sopa.", options=["me", "te", "nos", "les"]),
   d9("gap", "¿___ gusta bailar? (tú)", "Te", "Te = to you (informal).", "¿Te gusta bailar?", hint="to you"),
   d9("gap", "A ella le ___ la ciudad.", "gusta", "One thing: gusta.", "A ella le gusta la ciudad.", hint="gustar"),
   d9("translate", "I like coffee.", ["Me gusta el café.", "A mí me gusta el café."], "Me gusta + thing.", "Me gusta el café."),
   d9("translate", "She likes cats.", ["Le gustan los gatos.", "A ella le gustan los gatos."], "Plural thing: gustan.", "Le gustan los gatos."),
   d9("build", "I do not like soup.", ["No me gusta la sopa."], "No first.", "No me gusta la sopa.")], "dlg-cafe")

# ---- 10 possessives & prepositions
n[0] = 0
def d10(*a, **k): n[0] += 1; return D("possessives", n[0], *a, **k)
L("possessives", "Possessives and little words", "my, your, our, and the prepositions you need to say where things are.", [
  {"rule": "**mi** (my), **tu** (your), **su** (his / her / your formal / their), **nuestro/a** (our), **vuestro/a** (your pl). They agree with the *thing owned*, not the owner. Add **-s** for plurals: **mis amigos, tus libros**.",
   "examples": [ex("mi-hermano", "Este es mi hermano.", "This is my brother."), ex("tu-casa", "¿Dónde está tu casa?", "Where is your house?"), ex("nuestra-casa", "Es nuestra casa.", "It is our house.")],
   "trap": "**su** can mean his, her, your (formal) or their. Context decides."},
  {"rule": "**en** in/on/at · **de** of/from · **a** to · **con** with · **sin** without · **para** for · **cerca de** near · **lejos de** far from. **a + el = al**, **de + el = del**.",
   "examples": [ex("vivo-en", "Vivo en Madrid.", "I live in Madrid."), ex("cafe-con-leche", "Un café con leche, por favor.", "A coffee with milk, please."), ex("cerca-de-aqui", "El banco está cerca de aquí.", "The bank is near here."), ex("voy-al", "Voy al banco.", "I'm going to the bank.")]}],
  [d10("gap", "Este es ___ hermano. (my)", "mi", "My = mi.", "Este es mi hermano.", hint="my"),
   d10("gap", "¿Dónde está ___ casa? (your, tú)", "tu", "Your (informal) = tu.", "¿Dónde está tu casa?", hint="your"),
   d10("gap", "Ella habla con ___ madre. (her)", "su", "Her = su.", "Ella habla con su madre.", hint="her"),
   d10("gap", "Es ___ casa. (our)", "nuestra", "Casa is feminine: nuestra.", "Es nuestra casa.", hint="our"),
   d10("gap", "Es el coche ___ Ana. (of)", "de", "Ownership: de.", "Es el coche de Ana.", hint="of"),
   d10("gap", "Voy ___ la playa. (to)", "a", "Going to: a.", "Voy a la playa.", hint="to"),
   d10("gap", "Un café ___ leche, por favor. (with)", "con", "With: con.", "Un café con leche, por favor.", hint="with"),
   d10("gap", "El banco está ___ de aquí. (near)", "cerca", "Cerca de = near.", "El banco está cerca de aquí.", hint="near"),
   d10("choose", "Vivo ___ Madrid.", "en", "Living in a place: en.", "Vivo en Madrid.", options=["en", "a"]),
   d10("build", "I go with my friends.", ["Voy con mis amigos."], "Mis agrees with plural amigos.", "Voy con mis amigos."),
   d10("translate", "my friend (f)", ["mi amiga"], "Mi does not change for gender.", "Mi amiga.")], "dlg-directions")

dialogues = [
 {"id": "dlg-meeting", "title": "Meeting someone", "lines": [
  ("A", "¡Hola! ¿Cómo te llamas?", "Hi! What's your name?"), ("B", "Me llamo Luis. ¿Y tú?", "My name is Luis. And you?"),
  ("A", "Me llamo Ana. Mucho gusto.", "I'm Ana. Nice to meet you."), ("B", "Encantado. ¿De dónde eres?", "Pleased to meet you. Where are you from?"),
  ("A", "Soy de Sevilla. ¿Y tú?", "I'm from Seville. And you?"), ("B", "Soy de los Países Bajos, pero vivo en Madrid.", "I'm from the Netherlands, but I live in Madrid."),
  ("A", "¡Qué bien! ¿Hablas español?", "Great! Do you speak Spanish?"), ("B", "Un poco. Más despacio, por favor.", "A little. More slowly, please.")]},
 {"id": "dlg-cafe", "title": "At a café", "lines": [
  ("Camarero", "Buenas tardes. ¿Qué desea?", "Good afternoon. What would you like?"), ("Cliente", "Quisiera un café con leche, por favor.", "I'd like a coffee with milk, please."),
  ("Camarero", "¿Algo más?", "Anything else?"), ("Cliente", "Sí, un zumo de naranja.", "Yes, an orange juice."),
  ("Camarero", "Muy bien. Son tres euros.", "Very good. That's three euros."), ("Cliente", "¿Puedo pagar con tarjeta?", "Can I pay by card?"),
  ("Camarero", "Sí, claro.", "Yes, of course."), ("Cliente", "Gracias. Hasta luego.", "Thanks. See you later.")]},
 {"id": "dlg-directions", "title": "Asking the way", "lines": [
  ("Turista", "Perdone, ¿dónde está la estación?", "Excuse me, where is the station?"), ("Señora", "Siga todo recto.", "Keep going straight."),
  ("Turista", "¿Y después?", "And then?"), ("Señora", "Gire a la derecha. Está allí.", "Turn right. It's there."),
  ("Turista", "¿Está lejos de aquí?", "Is it far from here?"), ("Señora", "No, está a cinco minutos.", "No, it's five minutes away."),
  ("Turista", "Muchas gracias.", "Thank you very much."), ("Señora", "De nada.", "You're welcome.")]},
]
for d in dialogues:
    d["lines"] = [{"id": f"{d['id']}-{i+1}", "who": w, "es": es, "en": en} for i, (w, es, en) in enumerate(d["lines"])]

themes = {"prepositions": "Possessives & little words", "things": "Everyday things & jobs"}
vocab = [("mi", "mi", "my", "prepositions"), ("tu", "tu", "your (informal)", "prepositions"), ("su", "su", "his / her / your (formal) / their", "prepositions"),
  ("nuestro", "nuestro", "our (m)", "prepositions"), ("en", "en", "in / on / at", "prepositions"), ("de", "de", "of / from", "prepositions"),
  ("a", "a", "to / at", "prepositions"), ("con", "con", "with", "prepositions"), ("sin", "sin", "without", "prepositions"), ("para", "para", "for / in order to", "prepositions"),
  ("cerca-de", "cerca de", "near", "prepositions"), ("lejos-de", "lejos de", "far from", "prepositions"), ("mucho", "mucho", "a lot / much", "prepositions"),
  ("poco", "poco", "a little / not much", "prepositions"), ("tampoco", "tampoco", "neither / not either", "prepositions"),
  ("el-medico", "el médico", "the doctor (f: la médica)", "things"), ("el-profesor", "el profesor", "the teacher (f: la profesora)", "things"),
  ("el-estudiante", "el estudiante", "the student (f: la estudiante)", "things"), ("el-camarero", "el camarero", "the waiter (f: la camarera)", "things"),
  ("el-libro", "el libro", "the book", "things"), ("la-mesa", "la mesa", "the table", "things"), ("el-gato", "el gato", "the cat", "things"),
  ("el-perro", "el perro", "the dog", "things"), ("el-euro", "el euro", "the euro", "things"), ("la-tarjeta", "la tarjeta", "the card", "things"), ("el-dinero", "el dinero", "the money", "things")]

out = {"id": 1, "title": "Survive and introduce yourself", "goal": "Pronounce what you read, build simple sentences in the present tense, and handle first meetings, cafés and directions.",
  "canDo": ["Greet people and introduce yourself", "Say where you are from, your age and what you do", "Order food and drink and ask the price", "Ask where things are and tell the time"],
  "themes": themes, "vocab": [{"id": a, "es": b, "en": c, "t": t} for a, b, c, t in vocab], "lessons": lessons, "drills": drills, "dialogues": dialogues}
Path(__file__).resolve().parent.parent.joinpath("data", "ch1.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(len(lessons), "lessons", len(drills), "drills")
