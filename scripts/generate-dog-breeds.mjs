import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const akcGroups = [
  {
    groupName: "Sporting Group",
    breeds: [
      "American Water Spaniel",
      "Barbet",
      "Boykin Spaniel",
      "Bracco Italiano",
      "Brittany",
      "Chesapeake Bay Retriever",
      "Clumber Spaniel",
      "Cocker Spaniel",
      "Curly-Coated Retriever",
      "English Cocker Spaniel",
      "English Setter",
      "English Springer Spaniel",
      "Field Spaniel",
      "Flat-Coated Retriever",
      "German Shorthaired Pointer",
      "German Wirehaired Pointer",
      "Golden Retriever",
      "Gordon Setter",
      "Irish Red and White Setter",
      "Irish Setter",
      "Irish Water Spaniel",
      "Labrador Retriever",
      "Lagotto Romagnolo",
      "Nederlandse Kooikerhondje",
      "Nova Scotia Duck Tolling Retriever",
      "Pointer",
      "Spinone Italiano",
      "Sussex Spaniel",
      "Vizsla",
      "Weimaraner",
      "Welsh Springer Spaniel",
      "Wirehaired Pointing Griffon",
      "Wirehaired Vizsla"
    ]
  },
  {
    groupName: "Hound Group",
    breeds: [
      "Afghan Hound",
      "American English Coonhound",
      "American Foxhound",
      "Azawakh",
      "Basenji",
      "Basset Fauve de Bretagne",
      "Basset Hound",
      "Beagle",
      "Black and Tan Coonhound",
      "Bloodhound",
      "Bluetick Coonhound",
      "Borzoi",
      "Cirneco dell'Etna",
      "Dachshund",
      "English Foxhound",
      "Grand Basset Griffon Vendeen",
      "Greyhound",
      "Harrier",
      "Ibizan Hound",
      "Irish Wolfhound",
      "Norwegian Elkhound",
      "Otterhound",
      "Petit Basset Griffon Vendeen",
      "Pharaoh Hound",
      "Plott Hound",
      "Portuguese Podengo Pequeno",
      "Redbone Coonhound",
      "Rhodesian Ridgeback",
      "Saluki",
      "Scottish Deerhound",
      "Sloughi",
      "Treeing Walker Coonhound",
      "Whippet"
    ]
  },
  {
    groupName: "Working Group",
    breeds: [
      "Akita",
      "Alaskan Malamute",
      "Anatolian Shepherd Dog",
      "Bernese Mountain Dog",
      "Black Russian Terrier",
      "Boerboel",
      "Boxer",
      "Bullmastiff",
      "Cane Corso",
      "Chinook",
      "Danish-Swedish Farmdog",
      "Doberman Pinscher",
      "Dogo Argentino",
      "Dogue de Bordeaux",
      "German Pinscher",
      "Giant Schnauzer",
      "Great Dane",
      "Great Pyrenees",
      "Greater Swiss Mountain Dog",
      "Komondor",
      "Kuvasz",
      "Leonberger",
      "Mastiff",
      "Neapolitan Mastiff",
      "Newfoundland",
      "Portuguese Water Dog",
      "Rottweiler",
      "St. Bernard",
      "Samoyed",
      "Siberian Husky",
      "Standard Schnauzer",
      "Tibetan Mastiff"
    ]
  },
  {
    groupName: "Terrier Group",
    breeds: [
      "Airedale Terrier",
      "American Hairless Terrier",
      "American Staffordshire Terrier",
      "Australian Terrier",
      "Bedlington Terrier",
      "Border Terrier",
      "Bull Terrier",
      "Cairn Terrier",
      "Cesky Terrier",
      "Dandie Dinmont Terrier",
      "Glen of Imaal Terrier",
      "Irish Terrier",
      "Kerry Blue Terrier",
      "Lakeland Terrier",
      "Manchester Terrier",
      "Miniature Bull Terrier",
      "Miniature Schnauzer",
      "Norfolk Terrier",
      "Norwich Terrier",
      "Parson Russell Terrier",
      "Rat Terrier",
      "Russell Terrier",
      "Scottish Terrier",
      "Sealyham Terrier",
      "Skye Terrier",
      "Smooth Fox Terrier",
      "Soft Coated Wheaten Terrier",
      "Staffordshire Bull Terrier",
      "Teddy Roosevelt Terrier",
      "Welsh Terrier",
      "West Highland White Terrier",
      "Wire Fox Terrier"
    ]
  },
  {
    groupName: "Toy Group",
    breeds: [
      "Affenpinscher",
      "Biewer Terrier",
      "Brussels Griffon",
      "Cavalier King Charles Spaniel",
      "Chihuahua",
      "Chinese Crested",
      "English Toy Spaniel",
      "Havanese",
      "Italian Greyhound",
      "Japanese Chin",
      "Maltese",
      "Manchester Terrier",
      "Miniature Pinscher",
      "Papillon",
      "Pekingese",
      "Pomeranian",
      "Poodle",
      "Pug",
      "Russian Toy",
      "Russian Tsvetnaya Bolonka",
      "Shih Tzu",
      "Silky Terrier",
      "Toy Fox Terrier",
      "Yorkshire Terrier"
    ]
  },
  {
    groupName: "Non-Sporting Group",
    breeds: [
      "American Eskimo Dog",
      "Bichon Frise",
      "Boston Terrier",
      "Bulldog",
      "Chinese Shar-Pei",
      "Chow Chow",
      "Coton de Tulear",
      "Dalmatian",
      "Finnish Spitz",
      "French Bulldog",
      "Keeshond",
      "Lhasa Apso",
      "Lowchen",
      "Norwegian Lundehund",
      "Poodle",
      "Schipperke",
      "Shiba Inu",
      "Tibetan Spaniel",
      "Tibetan Terrier",
      "Xoloitzcuintli"
    ]
  },
  {
    groupName: "Herding Group",
    breeds: [
      "Australian Cattle Dog",
      "Australian Shepherd",
      "Bearded Collie",
      "Beauceron",
      "Belgian Laekenois",
      "Belgian Malinois",
      "Belgian Sheepdog",
      "Belgian Tervuren",
      "Bergamasco",
      "Berger Picard",
      "Border Collie",
      "Bouvier Des Flandres",
      "Briard",
      "Canaan Dog",
      "Cardigan Welsh Corgi",
      "Collie",
      "Entlebucher Mountain Dog",
      "Finnish Lapphund",
      "German Shepherd Dog",
      "Icelandic Sheepdog",
      "Lancashire Heeler",
      "Miniature American Shepherd",
      "Mudi",
      "Norwegian Buhund",
      "Old English Sheepdog",
      "Pembroke Welsh Corgi",
      "Polish Lowland Sheepdog",
      "Puli",
      "Pumi",
      "Pyrenean Shepherd",
      "Shetland Sheepdog",
      "Spanish Water Dog",
      "Swedish Vallhund"
    ]
  }
];

const koreanNames = new Map([
  ["affenpinscher", "아펜핀셔"],
  ["afghan-hound", "아프간 하운드"],
  ["airedale-terrier", "에어데일 테리어"],
  ["akita", "아키타"],
  ["alaskan-malamute", "알래스칸 말라뮤트"],
  ["american-bulldog", "아메리칸 불독"],
  ["american-eskimo-dog", "아메리칸 에스키모 도그"],
  ["american-staffordshire-terrier", "아메리칸 스태퍼드셔 테리어"],
  ["australian-cattle-dog", "오스트레일리안 캐틀 도그"],
  ["australian-shepherd", "오스트레일리안 셰퍼드"],
  ["australian-terrier", "오스트레일리안 테리어"],
  ["basenji", "바센지"],
  ["basset-hound", "바셋 하운드"],
  ["beagle", "비글"],
  ["bearded-collie", "비어디드 콜리"],
  ["bernese-mountain-dog", "버니즈 마운틴 도그"],
  ["bichon-frise", "비숑 프리제"],
  ["bloodhound", "블러드하운드"],
  ["border-collie", "보더콜리"],
  ["border-terrier", "보더 테리어"],
  ["borzoi", "보르조이"],
  ["boston-terrier", "보스턴 테리어"],
  ["boxer", "복서"],
  ["brittany", "브리타니"],
  ["brussels-griffon", "브뤼셀 그리펀"],
  ["bulldog", "불도그"],
  ["bull-terrier", "불 테리어"],
  ["bullmastiff", "불마스티프"],
  ["cairn-terrier", "케언 테리어"],
  ["canaan-dog", "카난 도그"],
  ["cane-corso", "카네 코르소"],
  ["cardigan-welsh-corgi", "카디건 웰시코기"],
  ["cavalier-king-charles-spaniel", "카발리에 킹 찰스 스패니얼"],
  ["chesapeake-bay-retriever", "체서피크 베이 리트리버"],
  ["chihuahua", "치와와"],
  ["chinese-crested", "차이니즈 크레스티드"],
  ["chinese-shar-pei", "차이니즈 샤페이"],
  ["chow-chow", "차우차우"],
  ["clumber-spaniel", "클럼버 스패니얼"],
  ["cocker-spaniel", "코커 스패니얼"],
  ["collie", "콜리"],
  ["coton-de-tulear", "꼬똥 드 툴레아"],
  ["dachshund", "닥스훈트"],
  ["dalmatian", "달마시안"],
  ["dandie-dinmont-terrier", "댄디 딘몬트 테리어"],
  ["doberman-pinscher", "도베르만 핀셔"],
  ["dogue-de-bordeaux", "도그 드 보르도"],
  ["english-cocker-spaniel", "잉글리시 코커 스패니얼"],
  ["english-setter", "잉글리시 세터"],
  ["english-springer-spaniel", "잉글리시 스프링어 스패니얼"],
  ["english-toy-spaniel", "잉글리시 토이 스패니얼"],
  ["finnish-lapphund", "핀란드 라프훈트"],
  ["finnish-spitz", "핀란드 스피츠"],
  ["flat-coated-retriever", "플랫 코티드 리트리버"],
  ["french-bulldog", "프렌치 불독"],
  ["german-pinscher", "저먼 핀셔"],
  ["german-shepherd-dog", "저먼 셰퍼드"],
  ["german-shorthaired-pointer", "저먼 쇼트헤어드 포인터"],
  ["german-wirehaired-pointer", "저먼 와이어헤어드 포인터"],
  ["giant-schnauzer", "자이언트 슈나우저"],
  ["golden-retriever", "골든 리트리버"],
  ["great-dane", "그레이트 데인"],
  ["great-pyrenees", "그레이트 피레니즈"],
  ["greyhound", "그레이하운드"],
  ["havanese", "하바니즈"],
  ["irish-setter", "아이리시 세터"],
  ["irish-wolfhound", "아이리시 울프하운드"],
  ["italian-greyhound", "이탈리안 그레이하운드"],
  ["japanese-chin", "재패니즈 친"],
  ["keeshond", "키스혼드"],
  ["kerry-blue-terrier", "케리 블루 테리어"],
  ["komondor", "코몬도르"],
  ["kuvasz", "쿠바스"],
  ["labrador-retriever", "래브라도 리트리버"],
  ["lagotto-romagnolo", "라고토 로마뇰로"],
  ["leonberger", "레온베르거"],
  ["lhasa-apso", "라사압소"],
  ["lowchen", "로첸"],
  ["maltese", "말티즈"],
  ["manchester-terrier", "맨체스터 테리어"],
  ["mastiff", "마스티프"],
  ["miniature-american-shepherd", "미니어처 아메리칸 셰퍼드"],
  ["miniature-bull-terrier", "미니어처 불 테리어"],
  ["miniature-pinscher", "미니어처 핀셔"],
  ["miniature-schnauzer", "미니어처 슈나우저"],
  ["mixed", "믹스견"],
  ["neapolitan-mastiff", "나폴리탄 마스티프"],
  ["newfoundland", "뉴펀들랜드"],
  ["norfolk-terrier", "노퍽 테리어"],
  ["norwegian-elkhound", "노르웨이 엘크하운드"],
  ["norwich-terrier", "노리치 테리어"],
  ["old-english-sheepdog", "올드 잉글리시 쉽독"],
  ["other", "기타"],
  ["papillon", "파피용"],
  ["pekingese", "페키니즈"],
  ["pembroke-welsh-corgi", "펨브로크 웰시코기"],
  ["pharaoh-hound", "파라오 하운드"],
  ["pointer", "포인터"],
  ["pomeranian", "포메라니안"],
  ["poodle", "푸들"],
  ["portuguese-water-dog", "포르투갈 워터 도그"],
  ["pug", "퍼그"],
  ["puli", "풀리"],
  ["rat-terrier", "랫 테리어"],
  ["rhodesian-ridgeback", "로디지안 리지백"],
  ["rottweiler", "로트와일러"],
  ["russell-terrier", "러셀 테리어"],
  ["saluki", "살루키"],
  ["samoyed", "사모예드"],
  ["schipperke", "스키퍼키"],
  ["scottish-terrier", "스코티시 테리어"],
  ["shetland-sheepdog", "셰틀랜드 쉽독"],
  ["shiba-inu", "시바견"],
  ["shih-tzu", "시츄"],
  ["siberian-husky", "시베리안 허스키"],
  ["silky-terrier", "실키 테리어"],
  ["soft-coated-wheaten-terrier", "소프트 코티드 휘튼 테리어"],
  ["st-bernard", "세인트 버나드"],
  ["staffordshire-bull-terrier", "스태퍼드셔 불 테리어"],
  ["standard-schnauzer", "스탠더드 슈나우저"],
  ["tibetan-mastiff", "티베탄 마스티프"],
  ["tibetan-spaniel", "티베탄 스패니얼"],
  ["tibetan-terrier", "티베탄 테리어"],
  ["toy-fox-terrier", "토이 폭스 테리어"],
  ["vizsla", "비즐라"],
  ["weimaraner", "와이마라너"],
  ["welsh-springer-spaniel", "웰시 스프링어 스패니얼"],
  ["welsh-terrier", "웰시 테리어"],
  ["west-highland-white-terrier", "웨스트 하이랜드 화이트 테리어"],
  ["whippet", "휘핏"],
  ["wire-fox-terrier", "와이어 폭스 테리어"],
  ["xoloitzcuintli", "솔로이츠퀸틀리"],
  ["yorkshire-terrier", "요크셔테리어"]
]);

const popularIds = new Set([
  "mixed",
  "maltese",
  "poodle",
  "pomeranian",
  "chihuahua",
  "shih-tzu",
  "bichon-frise",
  "pembroke-welsh-corgi",
  "cardigan-welsh-corgi",
  "french-bulldog",
  "shiba-inu",
  "dachshund",
  "golden-retriever",
  "labrador-retriever",
  "beagle",
  "miniature-schnauzer",
  "border-collie",
  "samoyed",
  "yorkshire-terrier"
]);

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(values) {
  if (!values.length) {
    return "'{}'::text[]";
  }

  return `array[${values.map(sqlString).join(", ")}]::text[]`;
}

function toBreedSeed(nameEn, groupName, index) {
  const id = slugify(nameEn);
  const nameKo = koreanNames.get(id) ?? nameEn;
  const aliases = Array.from(new Set([id, nameEn, nameKo])).filter(Boolean);

  return {
    id,
    nameKo,
    nameEn,
    groupName,
    aliases,
    isPopular: popularIds.has(id),
    source: "akc",
    sortOrder: popularIds.has(id) ? index + 10 : index + 1000
  };
}

const breedMap = new Map();
let sourceIndex = 0;

breedMap.set("mixed", {
  id: "mixed",
  nameKo: "믹스견",
  nameEn: "Mixed Breed",
  groupName: "Mixed",
  aliases: ["mixed", "mixed breed", "믹스견", "혼종"],
  isPopular: true,
  source: "meoksa",
  sortOrder: 0
});

for (const group of akcGroups) {
  for (const nameEn of group.breeds) {
    const breed = toBreedSeed(nameEn, group.groupName, sourceIndex);
    const existing = breedMap.get(breed.id);
    sourceIndex += 1;

    if (!existing) {
      breedMap.set(breed.id, breed);
      continue;
    }

    const groups = new Set(
      `${existing.groupName}, ${breed.groupName}`.split(",").map((item) => item.trim())
    );
    breedMap.set(breed.id, {
      ...existing,
      groupName: Array.from(groups).join(", ")
    });
  }
}

breedMap.set("other", {
  id: "other",
  nameKo: "기타",
  nameEn: "Other",
  groupName: "Other",
  aliases: ["other", "기타"],
  isPopular: false,
  source: "meoksa",
  sortOrder: 9999
});

const breeds = Array.from(breedMap.values()).sort((a, b) => {
  if (a.isPopular !== b.isPopular) {
    return a.isPopular ? -1 : 1;
  }

  return a.nameKo.localeCompare(b.nameKo, "ko");
});

const generatedDir = path.join(root, "src", "generated");
await mkdir(generatedDir, { recursive: true });

const tsFile = `export type DogBreedSeed = {
  id: string;
  nameKo: string;
  nameEn: string;
  groupName: string | null;
  aliases: string[];
  isPopular: boolean;
  source: string;
  sortOrder: number;
};

export const dogBreeds = ${JSON.stringify(breeds, null, 2)} satisfies DogBreedSeed[];

export const dogBreedIds: readonly string[] = dogBreeds.map((breed) => breed.id);
`;

await writeFile(path.join(generatedDir, "dog-breeds.generated.ts"), tsFile, "utf8");

const valuesSql = breeds
  .map(
    (breed) =>
      `(${sqlString(breed.id)}, ${sqlString(breed.nameKo)}, ${sqlString(
        breed.nameEn
      )}, ${sqlString(breed.groupName)}, ${sqlTextArray(breed.aliases)}, ${
        breed.isPopular
      }, ${sqlString(breed.source)}, ${breed.sortOrder})`
  )
  .join(",\n");

const seedSql = `create table if not exists public.dog_breeds (
  id text primary key,
  name_ko text not null,
  name_en text not null,
  group_name text,
  aliases text[] not null default '{}',
  is_popular boolean not null default false,
  source text not null default 'manual',
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dog_breeds_name_ko_idx on public.dog_breeds (name_ko);
create index if not exists dog_breeds_name_en_idx on public.dog_breeds (name_en);
create index if not exists dog_breeds_aliases_gin_idx on public.dog_breeds using gin (aliases);

alter table public.dog_breeds enable row level security;

drop policy if exists "Dog breeds are publicly readable" on public.dog_breeds;
create policy "Dog breeds are publicly readable"
  on public.dog_breeds for select
  using (true);

insert into public.dog_breeds (
  id,
  name_ko,
  name_en,
  group_name,
  aliases,
  is_popular,
  source,
  sort_order
)
values
${valuesSql}
on conflict (id) do update set
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  group_name = excluded.group_name,
  aliases = excluded.aliases,
  is_popular = excluded.is_popular,
  source = excluded.source,
  sort_order = excluded.sort_order,
  updated_at = now();
`;

await writeFile(path.join(root, "supabase", "dog_breeds_seed.sql"), seedSql, "utf8");

console.log(JSON.stringify({ generated: breeds.length, source: "AKC breeds by group" }));
