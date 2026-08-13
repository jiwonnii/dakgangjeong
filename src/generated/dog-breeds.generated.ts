export type DogBreedSeed = {
  id: string;
  nameKo: string;
  nameEn: string;
  groupName: string | null;
  aliases: string[];
  isPopular: boolean;
  source: string;
  sortOrder: number;
};

export const dogBreeds = [
  {
    "id": "golden-retriever",
    "nameKo": "골든 리트리버",
    "nameEn": "Golden Retriever",
    "groupName": "Sporting Group",
    "aliases": [
      "golden-retriever",
      "Golden Retriever",
      "골든 리트리버"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 26
  },
  {
    "id": "dachshund",
    "nameKo": "닥스훈트",
    "nameEn": "Dachshund",
    "groupName": "Hound Group",
    "aliases": [
      "dachshund",
      "Dachshund",
      "닥스훈트"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 56
  },
  {
    "id": "labrador-retriever",
    "nameKo": "래브라도 리트리버",
    "nameEn": "Labrador Retriever",
    "groupName": "Sporting Group",
    "aliases": [
      "labrador-retriever",
      "Labrador Retriever",
      "래브라도 리트리버"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 31
  },
  {
    "id": "maltese",
    "nameKo": "말티즈",
    "nameEn": "Maltese",
    "groupName": "Toy Group",
    "aliases": [
      "maltese",
      "Maltese",
      "말티즈"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 150
  },
  {
    "id": "miniature-schnauzer",
    "nameKo": "미니어처 슈나우저",
    "nameEn": "Miniature Schnauzer",
    "groupName": "Terrier Group",
    "aliases": [
      "miniature-schnauzer",
      "Miniature Schnauzer",
      "미니어처 슈나우저"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 124
  },
  {
    "id": "mixed",
    "nameKo": "믹스견",
    "nameEn": "Mixed Breed",
    "groupName": "Mixed",
    "aliases": [
      "mixed",
      "mixed breed",
      "믹스견",
      "혼종"
    ],
    "isPopular": true,
    "source": "meoksa",
    "sortOrder": 0
  },
  {
    "id": "border-collie",
    "nameKo": "보더콜리",
    "nameEn": "Border Collie",
    "groupName": "Herding Group",
    "aliases": [
      "border-collie",
      "Border Collie",
      "보더콜리"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 194
  },
  {
    "id": "beagle",
    "nameKo": "비글",
    "nameEn": "Beagle",
    "groupName": "Hound Group",
    "aliases": [
      "beagle",
      "Beagle",
      "비글"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 50
  },
  {
    "id": "bichon-frise",
    "nameKo": "비숑 프리제",
    "nameEn": "Bichon Frise",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "bichon-frise",
      "Bichon Frise",
      "비숑 프리제"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 165
  },
  {
    "id": "samoyed",
    "nameKo": "사모예드",
    "nameEn": "Samoyed",
    "groupName": "Working Group",
    "aliases": [
      "samoyed",
      "Samoyed",
      "사모예드"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 104
  },
  {
    "id": "shiba-inu",
    "nameKo": "시바견",
    "nameEn": "Shiba Inu",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "shiba-inu",
      "Shiba Inu",
      "시바견"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 180
  },
  {
    "id": "shih-tzu",
    "nameKo": "시츄",
    "nameEn": "Shih Tzu",
    "groupName": "Toy Group",
    "aliases": [
      "shih-tzu",
      "Shih Tzu",
      "시츄"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 160
  },
  {
    "id": "yorkshire-terrier",
    "nameKo": "요크셔테리어",
    "nameEn": "Yorkshire Terrier",
    "groupName": "Toy Group",
    "aliases": [
      "yorkshire-terrier",
      "Yorkshire Terrier",
      "요크셔테리어"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 163
  },
  {
    "id": "chihuahua",
    "nameKo": "치와와",
    "nameEn": "Chihuahua",
    "groupName": "Toy Group",
    "aliases": [
      "chihuahua",
      "Chihuahua",
      "치와와"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 144
  },
  {
    "id": "cardigan-welsh-corgi",
    "nameKo": "카디건 웰시코기",
    "nameEn": "Cardigan Welsh Corgi",
    "groupName": "Herding Group",
    "aliases": [
      "cardigan-welsh-corgi",
      "Cardigan Welsh Corgi",
      "카디건 웰시코기"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 198
  },
  {
    "id": "pembroke-welsh-corgi",
    "nameKo": "펨브로크 웰시코기",
    "nameEn": "Pembroke Welsh Corgi",
    "groupName": "Herding Group",
    "aliases": [
      "pembroke-welsh-corgi",
      "Pembroke Welsh Corgi",
      "펨브로크 웰시코기"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 209
  },
  {
    "id": "pomeranian",
    "nameKo": "포메라니안",
    "nameEn": "Pomeranian",
    "groupName": "Toy Group",
    "aliases": [
      "pomeranian",
      "Pomeranian",
      "포메라니안"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 155
  },
  {
    "id": "poodle",
    "nameKo": "푸들",
    "nameEn": "Poodle",
    "groupName": "Toy Group, Non-Sporting Group",
    "aliases": [
      "poodle",
      "Poodle",
      "푸들"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 156
  },
  {
    "id": "french-bulldog",
    "nameKo": "프렌치 불독",
    "nameEn": "French Bulldog",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "french-bulldog",
      "French Bulldog",
      "프렌치 불독"
    ],
    "isPopular": true,
    "source": "akc",
    "sortOrder": 173
  },
  {
    "id": "great-dane",
    "nameKo": "그레이트 데인",
    "nameEn": "Great Dane",
    "groupName": "Working Group",
    "aliases": [
      "great-dane",
      "Great Dane",
      "그레이트 데인"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1082
  },
  {
    "id": "great-pyrenees",
    "nameKo": "그레이트 피레니즈",
    "nameEn": "Great Pyrenees",
    "groupName": "Working Group",
    "aliases": [
      "great-pyrenees",
      "Great Pyrenees",
      "그레이트 피레니즈"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1083
  },
  {
    "id": "greyhound",
    "nameKo": "그레이하운드",
    "nameEn": "Greyhound",
    "groupName": "Hound Group",
    "aliases": [
      "greyhound",
      "Greyhound",
      "그레이하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1049
  },
  {
    "id": "other",
    "nameKo": "기타",
    "nameEn": "Other",
    "groupName": "Other",
    "aliases": [
      "other",
      "기타"
    ],
    "isPopular": false,
    "source": "meoksa",
    "sortOrder": 9999
  },
  {
    "id": "coton-de-tulear",
    "nameKo": "꼬똥 드 툴레아",
    "nameEn": "Coton de Tulear",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "coton-de-tulear",
      "Coton de Tulear",
      "꼬똥 드 툴레아"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1160
  },
  {
    "id": "neapolitan-mastiff",
    "nameKo": "나폴리탄 마스티프",
    "nameEn": "Neapolitan Mastiff",
    "groupName": "Working Group",
    "aliases": [
      "neapolitan-mastiff",
      "Neapolitan Mastiff",
      "나폴리탄 마스티프"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1089
  },
  {
    "id": "norwegian-elkhound",
    "nameKo": "노르웨이 엘크하운드",
    "nameEn": "Norwegian Elkhound",
    "groupName": "Hound Group",
    "aliases": [
      "norwegian-elkhound",
      "Norwegian Elkhound",
      "노르웨이 엘크하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1053
  },
  {
    "id": "norwich-terrier",
    "nameKo": "노리치 테리어",
    "nameEn": "Norwich Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "norwich-terrier",
      "Norwich Terrier",
      "노리치 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1116
  },
  {
    "id": "norfolk-terrier",
    "nameKo": "노퍽 테리어",
    "nameEn": "Norfolk Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "norfolk-terrier",
      "Norfolk Terrier",
      "노퍽 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1115
  },
  {
    "id": "newfoundland",
    "nameKo": "뉴펀들랜드",
    "nameEn": "Newfoundland",
    "groupName": "Working Group",
    "aliases": [
      "newfoundland",
      "Newfoundland",
      "뉴펀들랜드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1090
  },
  {
    "id": "dalmatian",
    "nameKo": "달마시안",
    "nameEn": "Dalmatian",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "dalmatian",
      "Dalmatian",
      "달마시안"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1161
  },
  {
    "id": "dandie-dinmont-terrier",
    "nameKo": "댄디 딘몬트 테리어",
    "nameEn": "Dandie Dinmont Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "dandie-dinmont-terrier",
      "Dandie Dinmont Terrier",
      "댄디 딘몬트 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1107
  },
  {
    "id": "dogue-de-bordeaux",
    "nameKo": "도그 드 보르도",
    "nameEn": "Dogue de Bordeaux",
    "groupName": "Working Group",
    "aliases": [
      "dogue-de-bordeaux",
      "Dogue de Bordeaux",
      "도그 드 보르도"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1079
  },
  {
    "id": "doberman-pinscher",
    "nameKo": "도베르만 핀셔",
    "nameEn": "Doberman Pinscher",
    "groupName": "Working Group",
    "aliases": [
      "doberman-pinscher",
      "Doberman Pinscher",
      "도베르만 핀셔"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1077
  },
  {
    "id": "lagotto-romagnolo",
    "nameKo": "라고토 로마뇰로",
    "nameEn": "Lagotto Romagnolo",
    "groupName": "Sporting Group",
    "aliases": [
      "lagotto-romagnolo",
      "Lagotto Romagnolo",
      "라고토 로마뇰로"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1022
  },
  {
    "id": "lhasa-apso",
    "nameKo": "라사압소",
    "nameEn": "Lhasa Apso",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "lhasa-apso",
      "Lhasa Apso",
      "라사압소"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1165
  },
  {
    "id": "rat-terrier",
    "nameKo": "랫 테리어",
    "nameEn": "Rat Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "rat-terrier",
      "Rat Terrier",
      "랫 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1118
  },
  {
    "id": "russell-terrier",
    "nameKo": "러셀 테리어",
    "nameEn": "Russell Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "russell-terrier",
      "Russell Terrier",
      "러셀 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1119
  },
  {
    "id": "leonberger",
    "nameKo": "레온베르거",
    "nameEn": "Leonberger",
    "groupName": "Working Group",
    "aliases": [
      "leonberger",
      "Leonberger",
      "레온베르거"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1087
  },
  {
    "id": "rhodesian-ridgeback",
    "nameKo": "로디지안 리지백",
    "nameEn": "Rhodesian Ridgeback",
    "groupName": "Hound Group",
    "aliases": [
      "rhodesian-ridgeback",
      "Rhodesian Ridgeback",
      "로디지안 리지백"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1060
  },
  {
    "id": "lowchen",
    "nameKo": "로첸",
    "nameEn": "Lowchen",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "lowchen",
      "Lowchen",
      "로첸"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1166
  },
  {
    "id": "rottweiler",
    "nameKo": "로트와일러",
    "nameEn": "Rottweiler",
    "groupName": "Working Group",
    "aliases": [
      "rottweiler",
      "Rottweiler",
      "로트와일러"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1092
  },
  {
    "id": "mastiff",
    "nameKo": "마스티프",
    "nameEn": "Mastiff",
    "groupName": "Working Group",
    "aliases": [
      "mastiff",
      "Mastiff",
      "마스티프"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1088
  },
  {
    "id": "manchester-terrier",
    "nameKo": "맨체스터 테리어",
    "nameEn": "Manchester Terrier",
    "groupName": "Terrier Group, Toy Group",
    "aliases": [
      "manchester-terrier",
      "Manchester Terrier",
      "맨체스터 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1112
  },
  {
    "id": "miniature-bull-terrier",
    "nameKo": "미니어처 불 테리어",
    "nameEn": "Miniature Bull Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "miniature-bull-terrier",
      "Miniature Bull Terrier",
      "미니어처 불 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1113
  },
  {
    "id": "miniature-american-shepherd",
    "nameKo": "미니어처 아메리칸 셰퍼드",
    "nameEn": "Miniature American Shepherd",
    "groupName": "Herding Group",
    "aliases": [
      "miniature-american-shepherd",
      "Miniature American Shepherd",
      "미니어처 아메리칸 셰퍼드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1195
  },
  {
    "id": "miniature-pinscher",
    "nameKo": "미니어처 핀셔",
    "nameEn": "Miniature Pinscher",
    "groupName": "Toy Group",
    "aliases": [
      "miniature-pinscher",
      "Miniature Pinscher",
      "미니어처 핀셔"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1142
  },
  {
    "id": "basenji",
    "nameKo": "바센지",
    "nameEn": "Basenji",
    "groupName": "Hound Group",
    "aliases": [
      "basenji",
      "Basenji",
      "바센지"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1037
  },
  {
    "id": "basset-hound",
    "nameKo": "바셋 하운드",
    "nameEn": "Basset Hound",
    "groupName": "Hound Group",
    "aliases": [
      "basset-hound",
      "Basset Hound",
      "바셋 하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1039
  },
  {
    "id": "bernese-mountain-dog",
    "nameKo": "버니즈 마운틴 도그",
    "nameEn": "Bernese Mountain Dog",
    "groupName": "Working Group",
    "aliases": [
      "bernese-mountain-dog",
      "Bernese Mountain Dog",
      "버니즈 마운틴 도그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1069
  },
  {
    "id": "border-terrier",
    "nameKo": "보더 테리어",
    "nameEn": "Border Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "border-terrier",
      "Border Terrier",
      "보더 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1103
  },
  {
    "id": "borzoi",
    "nameKo": "보르조이",
    "nameEn": "Borzoi",
    "groupName": "Hound Group",
    "aliases": [
      "borzoi",
      "Borzoi",
      "보르조이"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1044
  },
  {
    "id": "boston-terrier",
    "nameKo": "보스턴 테리어",
    "nameEn": "Boston Terrier",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "boston-terrier",
      "Boston Terrier",
      "보스턴 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1156
  },
  {
    "id": "boxer",
    "nameKo": "복서",
    "nameEn": "Boxer",
    "groupName": "Working Group",
    "aliases": [
      "boxer",
      "Boxer",
      "복서"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1072
  },
  {
    "id": "bull-terrier",
    "nameKo": "불 테리어",
    "nameEn": "Bull Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "bull-terrier",
      "Bull Terrier",
      "불 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1104
  },
  {
    "id": "bulldog",
    "nameKo": "불도그",
    "nameEn": "Bulldog",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "bulldog",
      "Bulldog",
      "불도그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1157
  },
  {
    "id": "bullmastiff",
    "nameKo": "불마스티프",
    "nameEn": "Bullmastiff",
    "groupName": "Working Group",
    "aliases": [
      "bullmastiff",
      "Bullmastiff",
      "불마스티프"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1073
  },
  {
    "id": "brussels-griffon",
    "nameKo": "브뤼셀 그리펀",
    "nameEn": "Brussels Griffon",
    "groupName": "Toy Group",
    "aliases": [
      "brussels-griffon",
      "Brussels Griffon",
      "브뤼셀 그리펀"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1132
  },
  {
    "id": "brittany",
    "nameKo": "브리타니",
    "nameEn": "Brittany",
    "groupName": "Sporting Group",
    "aliases": [
      "brittany",
      "Brittany",
      "브리타니"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1004
  },
  {
    "id": "bloodhound",
    "nameKo": "블러드하운드",
    "nameEn": "Bloodhound",
    "groupName": "Hound Group",
    "aliases": [
      "bloodhound",
      "Bloodhound",
      "블러드하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1042
  },
  {
    "id": "bearded-collie",
    "nameKo": "비어디드 콜리",
    "nameEn": "Bearded Collie",
    "groupName": "Herding Group",
    "aliases": [
      "bearded-collie",
      "Bearded Collie",
      "비어디드 콜리"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1176
  },
  {
    "id": "vizsla",
    "nameKo": "비즐라",
    "nameEn": "Vizsla",
    "groupName": "Sporting Group",
    "aliases": [
      "vizsla",
      "Vizsla",
      "비즐라"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1028
  },
  {
    "id": "saluki",
    "nameKo": "살루키",
    "nameEn": "Saluki",
    "groupName": "Hound Group",
    "aliases": [
      "saluki",
      "Saluki",
      "살루키"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1061
  },
  {
    "id": "st-bernard",
    "nameKo": "세인트 버나드",
    "nameEn": "St. Bernard",
    "groupName": "Working Group",
    "aliases": [
      "st-bernard",
      "St. Bernard",
      "세인트 버나드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1093
  },
  {
    "id": "shetland-sheepdog",
    "nameKo": "셰틀랜드 쉽독",
    "nameEn": "Shetland Sheepdog",
    "groupName": "Herding Group",
    "aliases": [
      "shetland-sheepdog",
      "Shetland Sheepdog",
      "셰틀랜드 쉽독"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1204
  },
  {
    "id": "soft-coated-wheaten-terrier",
    "nameKo": "소프트 코티드 휘튼 테리어",
    "nameEn": "Soft Coated Wheaten Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "soft-coated-wheaten-terrier",
      "Soft Coated Wheaten Terrier",
      "소프트 코티드 휘튼 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1124
  },
  {
    "id": "xoloitzcuintli",
    "nameKo": "솔로이츠퀸틀리",
    "nameEn": "Xoloitzcuintli",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "xoloitzcuintli",
      "Xoloitzcuintli",
      "솔로이츠퀸틀리"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1173
  },
  {
    "id": "scottish-terrier",
    "nameKo": "스코티시 테리어",
    "nameEn": "Scottish Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "scottish-terrier",
      "Scottish Terrier",
      "스코티시 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1120
  },
  {
    "id": "schipperke",
    "nameKo": "스키퍼키",
    "nameEn": "Schipperke",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "schipperke",
      "Schipperke",
      "스키퍼키"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1169
  },
  {
    "id": "staffordshire-bull-terrier",
    "nameKo": "스태퍼드셔 불 테리어",
    "nameEn": "Staffordshire Bull Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "staffordshire-bull-terrier",
      "Staffordshire Bull Terrier",
      "스태퍼드셔 불 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1125
  },
  {
    "id": "standard-schnauzer",
    "nameKo": "스탠더드 슈나우저",
    "nameEn": "Standard Schnauzer",
    "groupName": "Working Group",
    "aliases": [
      "standard-schnauzer",
      "Standard Schnauzer",
      "스탠더드 슈나우저"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1096
  },
  {
    "id": "siberian-husky",
    "nameKo": "시베리안 허스키",
    "nameEn": "Siberian Husky",
    "groupName": "Working Group",
    "aliases": [
      "siberian-husky",
      "Siberian Husky",
      "시베리안 허스키"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1095
  },
  {
    "id": "silky-terrier",
    "nameKo": "실키 테리어",
    "nameEn": "Silky Terrier",
    "groupName": "Toy Group",
    "aliases": [
      "silky-terrier",
      "Silky Terrier",
      "실키 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1151
  },
  {
    "id": "american-staffordshire-terrier",
    "nameKo": "아메리칸 스태퍼드셔 테리어",
    "nameEn": "American Staffordshire Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "american-staffordshire-terrier",
      "American Staffordshire Terrier",
      "아메리칸 스태퍼드셔 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1100
  },
  {
    "id": "american-eskimo-dog",
    "nameKo": "아메리칸 에스키모 도그",
    "nameEn": "American Eskimo Dog",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "american-eskimo-dog",
      "American Eskimo Dog",
      "아메리칸 에스키모 도그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1154
  },
  {
    "id": "irish-setter",
    "nameKo": "아이리시 세터",
    "nameEn": "Irish Setter",
    "groupName": "Sporting Group",
    "aliases": [
      "irish-setter",
      "Irish Setter",
      "아이리시 세터"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1019
  },
  {
    "id": "irish-wolfhound",
    "nameKo": "아이리시 울프하운드",
    "nameEn": "Irish Wolfhound",
    "groupName": "Hound Group",
    "aliases": [
      "irish-wolfhound",
      "Irish Wolfhound",
      "아이리시 울프하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1052
  },
  {
    "id": "akita",
    "nameKo": "아키타",
    "nameEn": "Akita",
    "groupName": "Working Group",
    "aliases": [
      "akita",
      "Akita",
      "아키타"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1066
  },
  {
    "id": "affenpinscher",
    "nameKo": "아펜핀셔",
    "nameEn": "Affenpinscher",
    "groupName": "Toy Group",
    "aliases": [
      "affenpinscher",
      "Affenpinscher",
      "아펜핀셔"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1130
  },
  {
    "id": "afghan-hound",
    "nameKo": "아프간 하운드",
    "nameEn": "Afghan Hound",
    "groupName": "Hound Group",
    "aliases": [
      "afghan-hound",
      "Afghan Hound",
      "아프간 하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1033
  },
  {
    "id": "alaskan-malamute",
    "nameKo": "알래스칸 말라뮤트",
    "nameEn": "Alaskan Malamute",
    "groupName": "Working Group",
    "aliases": [
      "alaskan-malamute",
      "Alaskan Malamute",
      "알래스칸 말라뮤트"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1067
  },
  {
    "id": "airedale-terrier",
    "nameKo": "에어데일 테리어",
    "nameEn": "Airedale Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "airedale-terrier",
      "Airedale Terrier",
      "에어데일 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1098
  },
  {
    "id": "australian-shepherd",
    "nameKo": "오스트레일리안 셰퍼드",
    "nameEn": "Australian Shepherd",
    "groupName": "Herding Group",
    "aliases": [
      "australian-shepherd",
      "Australian Shepherd",
      "오스트레일리안 셰퍼드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1175
  },
  {
    "id": "australian-cattle-dog",
    "nameKo": "오스트레일리안 캐틀 도그",
    "nameEn": "Australian Cattle Dog",
    "groupName": "Herding Group",
    "aliases": [
      "australian-cattle-dog",
      "Australian Cattle Dog",
      "오스트레일리안 캐틀 도그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1174
  },
  {
    "id": "australian-terrier",
    "nameKo": "오스트레일리안 테리어",
    "nameEn": "Australian Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "australian-terrier",
      "Australian Terrier",
      "오스트레일리안 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1101
  },
  {
    "id": "old-english-sheepdog",
    "nameKo": "올드 잉글리시 쉽독",
    "nameEn": "Old English Sheepdog",
    "groupName": "Herding Group",
    "aliases": [
      "old-english-sheepdog",
      "Old English Sheepdog",
      "올드 잉글리시 쉽독"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1198
  },
  {
    "id": "weimaraner",
    "nameKo": "와이마라너",
    "nameEn": "Weimaraner",
    "groupName": "Sporting Group",
    "aliases": [
      "weimaraner",
      "Weimaraner",
      "와이마라너"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1029
  },
  {
    "id": "wire-fox-terrier",
    "nameKo": "와이어 폭스 테리어",
    "nameEn": "Wire Fox Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "wire-fox-terrier",
      "Wire Fox Terrier",
      "와이어 폭스 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1129
  },
  {
    "id": "west-highland-white-terrier",
    "nameKo": "웨스트 하이랜드 화이트 테리어",
    "nameEn": "West Highland White Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "west-highland-white-terrier",
      "West Highland White Terrier",
      "웨스트 하이랜드 화이트 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1128
  },
  {
    "id": "welsh-springer-spaniel",
    "nameKo": "웰시 스프링어 스패니얼",
    "nameEn": "Welsh Springer Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "welsh-springer-spaniel",
      "Welsh Springer Spaniel",
      "웰시 스프링어 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1030
  },
  {
    "id": "welsh-terrier",
    "nameKo": "웰시 테리어",
    "nameEn": "Welsh Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "welsh-terrier",
      "Welsh Terrier",
      "웰시 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1127
  },
  {
    "id": "italian-greyhound",
    "nameKo": "이탈리안 그레이하운드",
    "nameEn": "Italian Greyhound",
    "groupName": "Toy Group",
    "aliases": [
      "italian-greyhound",
      "Italian Greyhound",
      "이탈리안 그레이하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1138
  },
  {
    "id": "english-setter",
    "nameKo": "잉글리시 세터",
    "nameEn": "English Setter",
    "groupName": "Sporting Group",
    "aliases": [
      "english-setter",
      "English Setter",
      "잉글리시 세터"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1010
  },
  {
    "id": "english-springer-spaniel",
    "nameKo": "잉글리시 스프링어 스패니얼",
    "nameEn": "English Springer Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "english-springer-spaniel",
      "English Springer Spaniel",
      "잉글리시 스프링어 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1011
  },
  {
    "id": "english-cocker-spaniel",
    "nameKo": "잉글리시 코커 스패니얼",
    "nameEn": "English Cocker Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "english-cocker-spaniel",
      "English Cocker Spaniel",
      "잉글리시 코커 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1009
  },
  {
    "id": "english-toy-spaniel",
    "nameKo": "잉글리시 토이 스패니얼",
    "nameEn": "English Toy Spaniel",
    "groupName": "Toy Group",
    "aliases": [
      "english-toy-spaniel",
      "English Toy Spaniel",
      "잉글리시 토이 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1136
  },
  {
    "id": "giant-schnauzer",
    "nameKo": "자이언트 슈나우저",
    "nameEn": "Giant Schnauzer",
    "groupName": "Working Group",
    "aliases": [
      "giant-schnauzer",
      "Giant Schnauzer",
      "자이언트 슈나우저"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1081
  },
  {
    "id": "japanese-chin",
    "nameKo": "재패니즈 친",
    "nameEn": "Japanese Chin",
    "groupName": "Toy Group",
    "aliases": [
      "japanese-chin",
      "Japanese Chin",
      "재패니즈 친"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1139
  },
  {
    "id": "german-shepherd-dog",
    "nameKo": "저먼 셰퍼드",
    "nameEn": "German Shepherd Dog",
    "groupName": "Herding Group",
    "aliases": [
      "german-shepherd-dog",
      "German Shepherd Dog",
      "저먼 셰퍼드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1192
  },
  {
    "id": "german-shorthaired-pointer",
    "nameKo": "저먼 쇼트헤어드 포인터",
    "nameEn": "German Shorthaired Pointer",
    "groupName": "Sporting Group",
    "aliases": [
      "german-shorthaired-pointer",
      "German Shorthaired Pointer",
      "저먼 쇼트헤어드 포인터"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1014
  },
  {
    "id": "german-wirehaired-pointer",
    "nameKo": "저먼 와이어헤어드 포인터",
    "nameEn": "German Wirehaired Pointer",
    "groupName": "Sporting Group",
    "aliases": [
      "german-wirehaired-pointer",
      "German Wirehaired Pointer",
      "저먼 와이어헤어드 포인터"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1015
  },
  {
    "id": "german-pinscher",
    "nameKo": "저먼 핀셔",
    "nameEn": "German Pinscher",
    "groupName": "Working Group",
    "aliases": [
      "german-pinscher",
      "German Pinscher",
      "저먼 핀셔"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1080
  },
  {
    "id": "chow-chow",
    "nameKo": "차우차우",
    "nameEn": "Chow Chow",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "chow-chow",
      "Chow Chow",
      "차우차우"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1159
  },
  {
    "id": "chinese-shar-pei",
    "nameKo": "차이니즈 샤페이",
    "nameEn": "Chinese Shar-Pei",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "chinese-shar-pei",
      "Chinese Shar-Pei",
      "차이니즈 샤페이"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1158
  },
  {
    "id": "chinese-crested",
    "nameKo": "차이니즈 크레스티드",
    "nameEn": "Chinese Crested",
    "groupName": "Toy Group",
    "aliases": [
      "chinese-crested",
      "Chinese Crested",
      "차이니즈 크레스티드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1135
  },
  {
    "id": "chesapeake-bay-retriever",
    "nameKo": "체서피크 베이 리트리버",
    "nameEn": "Chesapeake Bay Retriever",
    "groupName": "Sporting Group",
    "aliases": [
      "chesapeake-bay-retriever",
      "Chesapeake Bay Retriever",
      "체서피크 베이 리트리버"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1005
  },
  {
    "id": "canaan-dog",
    "nameKo": "카난 도그",
    "nameEn": "Canaan Dog",
    "groupName": "Herding Group",
    "aliases": [
      "canaan-dog",
      "Canaan Dog",
      "카난 도그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1187
  },
  {
    "id": "cane-corso",
    "nameKo": "카네 코르소",
    "nameEn": "Cane Corso",
    "groupName": "Working Group",
    "aliases": [
      "cane-corso",
      "Cane Corso",
      "카네 코르소"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1074
  },
  {
    "id": "cavalier-king-charles-spaniel",
    "nameKo": "카발리에 킹 찰스 스패니얼",
    "nameEn": "Cavalier King Charles Spaniel",
    "groupName": "Toy Group",
    "aliases": [
      "cavalier-king-charles-spaniel",
      "Cavalier King Charles Spaniel",
      "카발리에 킹 찰스 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1133
  },
  {
    "id": "kerry-blue-terrier",
    "nameKo": "케리 블루 테리어",
    "nameEn": "Kerry Blue Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "kerry-blue-terrier",
      "Kerry Blue Terrier",
      "케리 블루 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1110
  },
  {
    "id": "cairn-terrier",
    "nameKo": "케언 테리어",
    "nameEn": "Cairn Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "cairn-terrier",
      "Cairn Terrier",
      "케언 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1105
  },
  {
    "id": "komondor",
    "nameKo": "코몬도르",
    "nameEn": "Komondor",
    "groupName": "Working Group",
    "aliases": [
      "komondor",
      "Komondor",
      "코몬도르"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1085
  },
  {
    "id": "cocker-spaniel",
    "nameKo": "코커 스패니얼",
    "nameEn": "Cocker Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "cocker-spaniel",
      "Cocker Spaniel",
      "코커 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1007
  },
  {
    "id": "collie",
    "nameKo": "콜리",
    "nameEn": "Collie",
    "groupName": "Herding Group",
    "aliases": [
      "collie",
      "Collie",
      "콜리"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1189
  },
  {
    "id": "kuvasz",
    "nameKo": "쿠바스",
    "nameEn": "Kuvasz",
    "groupName": "Working Group",
    "aliases": [
      "kuvasz",
      "Kuvasz",
      "쿠바스"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1086
  },
  {
    "id": "clumber-spaniel",
    "nameKo": "클럼버 스패니얼",
    "nameEn": "Clumber Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "clumber-spaniel",
      "Clumber Spaniel",
      "클럼버 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1006
  },
  {
    "id": "keeshond",
    "nameKo": "키스혼드",
    "nameEn": "Keeshond",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "keeshond",
      "Keeshond",
      "키스혼드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1164
  },
  {
    "id": "toy-fox-terrier",
    "nameKo": "토이 폭스 테리어",
    "nameEn": "Toy Fox Terrier",
    "groupName": "Toy Group",
    "aliases": [
      "toy-fox-terrier",
      "Toy Fox Terrier",
      "토이 폭스 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1152
  },
  {
    "id": "tibetan-mastiff",
    "nameKo": "티베탄 마스티프",
    "nameEn": "Tibetan Mastiff",
    "groupName": "Working Group",
    "aliases": [
      "tibetan-mastiff",
      "Tibetan Mastiff",
      "티베탄 마스티프"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1097
  },
  {
    "id": "tibetan-spaniel",
    "nameKo": "티베탄 스패니얼",
    "nameEn": "Tibetan Spaniel",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "tibetan-spaniel",
      "Tibetan Spaniel",
      "티베탄 스패니얼"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1171
  },
  {
    "id": "tibetan-terrier",
    "nameKo": "티베탄 테리어",
    "nameEn": "Tibetan Terrier",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "tibetan-terrier",
      "Tibetan Terrier",
      "티베탄 테리어"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1172
  },
  {
    "id": "pharaoh-hound",
    "nameKo": "파라오 하운드",
    "nameEn": "Pharaoh Hound",
    "groupName": "Hound Group",
    "aliases": [
      "pharaoh-hound",
      "Pharaoh Hound",
      "파라오 하운드"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1056
  },
  {
    "id": "papillon",
    "nameKo": "파피용",
    "nameEn": "Papillon",
    "groupName": "Toy Group",
    "aliases": [
      "papillon",
      "Papillon",
      "파피용"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1143
  },
  {
    "id": "pug",
    "nameKo": "퍼그",
    "nameEn": "Pug",
    "groupName": "Toy Group",
    "aliases": [
      "pug",
      "Pug",
      "퍼그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1147
  },
  {
    "id": "pekingese",
    "nameKo": "페키니즈",
    "nameEn": "Pekingese",
    "groupName": "Toy Group",
    "aliases": [
      "pekingese",
      "Pekingese",
      "페키니즈"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1144
  },
  {
    "id": "portuguese-water-dog",
    "nameKo": "포르투갈 워터 도그",
    "nameEn": "Portuguese Water Dog",
    "groupName": "Working Group",
    "aliases": [
      "portuguese-water-dog",
      "Portuguese Water Dog",
      "포르투갈 워터 도그"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1091
  },
  {
    "id": "pointer",
    "nameKo": "포인터",
    "nameEn": "Pointer",
    "groupName": "Sporting Group",
    "aliases": [
      "pointer",
      "Pointer",
      "포인터"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1025
  },
  {
    "id": "puli",
    "nameKo": "풀리",
    "nameEn": "Puli",
    "groupName": "Herding Group",
    "aliases": [
      "puli",
      "Puli",
      "풀리"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1201
  },
  {
    "id": "flat-coated-retriever",
    "nameKo": "플랫 코티드 리트리버",
    "nameEn": "Flat-Coated Retriever",
    "groupName": "Sporting Group",
    "aliases": [
      "flat-coated-retriever",
      "Flat-Coated Retriever",
      "플랫 코티드 리트리버"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1013
  },
  {
    "id": "finnish-lapphund",
    "nameKo": "핀란드 라프훈트",
    "nameEn": "Finnish Lapphund",
    "groupName": "Herding Group",
    "aliases": [
      "finnish-lapphund",
      "Finnish Lapphund",
      "핀란드 라프훈트"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1191
  },
  {
    "id": "finnish-spitz",
    "nameKo": "핀란드 스피츠",
    "nameEn": "Finnish Spitz",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "finnish-spitz",
      "Finnish Spitz",
      "핀란드 스피츠"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1162
  },
  {
    "id": "havanese",
    "nameKo": "하바니즈",
    "nameEn": "Havanese",
    "groupName": "Toy Group",
    "aliases": [
      "havanese",
      "Havanese",
      "하바니즈"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1137
  },
  {
    "id": "whippet",
    "nameKo": "휘핏",
    "nameEn": "Whippet",
    "groupName": "Hound Group",
    "aliases": [
      "whippet",
      "Whippet",
      "휘핏"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1065
  },
  {
    "id": "american-english-coonhound",
    "nameKo": "American English Coonhound",
    "nameEn": "American English Coonhound",
    "groupName": "Hound Group",
    "aliases": [
      "american-english-coonhound",
      "American English Coonhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1034
  },
  {
    "id": "american-foxhound",
    "nameKo": "American Foxhound",
    "nameEn": "American Foxhound",
    "groupName": "Hound Group",
    "aliases": [
      "american-foxhound",
      "American Foxhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1035
  },
  {
    "id": "american-hairless-terrier",
    "nameKo": "American Hairless Terrier",
    "nameEn": "American Hairless Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "american-hairless-terrier",
      "American Hairless Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1099
  },
  {
    "id": "american-water-spaniel",
    "nameKo": "American Water Spaniel",
    "nameEn": "American Water Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "american-water-spaniel",
      "American Water Spaniel"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1000
  },
  {
    "id": "anatolian-shepherd-dog",
    "nameKo": "Anatolian Shepherd Dog",
    "nameEn": "Anatolian Shepherd Dog",
    "groupName": "Working Group",
    "aliases": [
      "anatolian-shepherd-dog",
      "Anatolian Shepherd Dog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1068
  },
  {
    "id": "azawakh",
    "nameKo": "Azawakh",
    "nameEn": "Azawakh",
    "groupName": "Hound Group",
    "aliases": [
      "azawakh",
      "Azawakh"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1036
  },
  {
    "id": "barbet",
    "nameKo": "Barbet",
    "nameEn": "Barbet",
    "groupName": "Sporting Group",
    "aliases": [
      "barbet",
      "Barbet"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1001
  },
  {
    "id": "basset-fauve-de-bretagne",
    "nameKo": "Basset Fauve de Bretagne",
    "nameEn": "Basset Fauve de Bretagne",
    "groupName": "Hound Group",
    "aliases": [
      "basset-fauve-de-bretagne",
      "Basset Fauve de Bretagne"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1038
  },
  {
    "id": "beauceron",
    "nameKo": "Beauceron",
    "nameEn": "Beauceron",
    "groupName": "Herding Group",
    "aliases": [
      "beauceron",
      "Beauceron"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1177
  },
  {
    "id": "bedlington-terrier",
    "nameKo": "Bedlington Terrier",
    "nameEn": "Bedlington Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "bedlington-terrier",
      "Bedlington Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1102
  },
  {
    "id": "belgian-laekenois",
    "nameKo": "Belgian Laekenois",
    "nameEn": "Belgian Laekenois",
    "groupName": "Herding Group",
    "aliases": [
      "belgian-laekenois",
      "Belgian Laekenois"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1178
  },
  {
    "id": "belgian-malinois",
    "nameKo": "Belgian Malinois",
    "nameEn": "Belgian Malinois",
    "groupName": "Herding Group",
    "aliases": [
      "belgian-malinois",
      "Belgian Malinois"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1179
  },
  {
    "id": "belgian-sheepdog",
    "nameKo": "Belgian Sheepdog",
    "nameEn": "Belgian Sheepdog",
    "groupName": "Herding Group",
    "aliases": [
      "belgian-sheepdog",
      "Belgian Sheepdog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1180
  },
  {
    "id": "belgian-tervuren",
    "nameKo": "Belgian Tervuren",
    "nameEn": "Belgian Tervuren",
    "groupName": "Herding Group",
    "aliases": [
      "belgian-tervuren",
      "Belgian Tervuren"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1181
  },
  {
    "id": "bergamasco",
    "nameKo": "Bergamasco",
    "nameEn": "Bergamasco",
    "groupName": "Herding Group",
    "aliases": [
      "bergamasco",
      "Bergamasco"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1182
  },
  {
    "id": "berger-picard",
    "nameKo": "Berger Picard",
    "nameEn": "Berger Picard",
    "groupName": "Herding Group",
    "aliases": [
      "berger-picard",
      "Berger Picard"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1183
  },
  {
    "id": "biewer-terrier",
    "nameKo": "Biewer Terrier",
    "nameEn": "Biewer Terrier",
    "groupName": "Toy Group",
    "aliases": [
      "biewer-terrier",
      "Biewer Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1131
  },
  {
    "id": "black-and-tan-coonhound",
    "nameKo": "Black and Tan Coonhound",
    "nameEn": "Black and Tan Coonhound",
    "groupName": "Hound Group",
    "aliases": [
      "black-and-tan-coonhound",
      "Black and Tan Coonhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1041
  },
  {
    "id": "black-russian-terrier",
    "nameKo": "Black Russian Terrier",
    "nameEn": "Black Russian Terrier",
    "groupName": "Working Group",
    "aliases": [
      "black-russian-terrier",
      "Black Russian Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1070
  },
  {
    "id": "bluetick-coonhound",
    "nameKo": "Bluetick Coonhound",
    "nameEn": "Bluetick Coonhound",
    "groupName": "Hound Group",
    "aliases": [
      "bluetick-coonhound",
      "Bluetick Coonhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1043
  },
  {
    "id": "boerboel",
    "nameKo": "Boerboel",
    "nameEn": "Boerboel",
    "groupName": "Working Group",
    "aliases": [
      "boerboel",
      "Boerboel"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1071
  },
  {
    "id": "bouvier-des-flandres",
    "nameKo": "Bouvier Des Flandres",
    "nameEn": "Bouvier Des Flandres",
    "groupName": "Herding Group",
    "aliases": [
      "bouvier-des-flandres",
      "Bouvier Des Flandres"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1185
  },
  {
    "id": "boykin-spaniel",
    "nameKo": "Boykin Spaniel",
    "nameEn": "Boykin Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "boykin-spaniel",
      "Boykin Spaniel"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1002
  },
  {
    "id": "bracco-italiano",
    "nameKo": "Bracco Italiano",
    "nameEn": "Bracco Italiano",
    "groupName": "Sporting Group",
    "aliases": [
      "bracco-italiano",
      "Bracco Italiano"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1003
  },
  {
    "id": "briard",
    "nameKo": "Briard",
    "nameEn": "Briard",
    "groupName": "Herding Group",
    "aliases": [
      "briard",
      "Briard"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1186
  },
  {
    "id": "cesky-terrier",
    "nameKo": "Cesky Terrier",
    "nameEn": "Cesky Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "cesky-terrier",
      "Cesky Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1106
  },
  {
    "id": "chinook",
    "nameKo": "Chinook",
    "nameEn": "Chinook",
    "groupName": "Working Group",
    "aliases": [
      "chinook",
      "Chinook"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1075
  },
  {
    "id": "cirneco-delletna",
    "nameKo": "Cirneco dell'Etna",
    "nameEn": "Cirneco dell'Etna",
    "groupName": "Hound Group",
    "aliases": [
      "cirneco-delletna",
      "Cirneco dell'Etna"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1045
  },
  {
    "id": "curly-coated-retriever",
    "nameKo": "Curly-Coated Retriever",
    "nameEn": "Curly-Coated Retriever",
    "groupName": "Sporting Group",
    "aliases": [
      "curly-coated-retriever",
      "Curly-Coated Retriever"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1008
  },
  {
    "id": "danish-swedish-farmdog",
    "nameKo": "Danish-Swedish Farmdog",
    "nameEn": "Danish-Swedish Farmdog",
    "groupName": "Working Group",
    "aliases": [
      "danish-swedish-farmdog",
      "Danish-Swedish Farmdog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1076
  },
  {
    "id": "dogo-argentino",
    "nameKo": "Dogo Argentino",
    "nameEn": "Dogo Argentino",
    "groupName": "Working Group",
    "aliases": [
      "dogo-argentino",
      "Dogo Argentino"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1078
  },
  {
    "id": "english-foxhound",
    "nameKo": "English Foxhound",
    "nameEn": "English Foxhound",
    "groupName": "Hound Group",
    "aliases": [
      "english-foxhound",
      "English Foxhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1047
  },
  {
    "id": "entlebucher-mountain-dog",
    "nameKo": "Entlebucher Mountain Dog",
    "nameEn": "Entlebucher Mountain Dog",
    "groupName": "Herding Group",
    "aliases": [
      "entlebucher-mountain-dog",
      "Entlebucher Mountain Dog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1190
  },
  {
    "id": "field-spaniel",
    "nameKo": "Field Spaniel",
    "nameEn": "Field Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "field-spaniel",
      "Field Spaniel"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1012
  },
  {
    "id": "glen-of-imaal-terrier",
    "nameKo": "Glen of Imaal Terrier",
    "nameEn": "Glen of Imaal Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "glen-of-imaal-terrier",
      "Glen of Imaal Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1108
  },
  {
    "id": "gordon-setter",
    "nameKo": "Gordon Setter",
    "nameEn": "Gordon Setter",
    "groupName": "Sporting Group",
    "aliases": [
      "gordon-setter",
      "Gordon Setter"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1017
  },
  {
    "id": "grand-basset-griffon-vendeen",
    "nameKo": "Grand Basset Griffon Vendeen",
    "nameEn": "Grand Basset Griffon Vendeen",
    "groupName": "Hound Group",
    "aliases": [
      "grand-basset-griffon-vendeen",
      "Grand Basset Griffon Vendeen"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1048
  },
  {
    "id": "greater-swiss-mountain-dog",
    "nameKo": "Greater Swiss Mountain Dog",
    "nameEn": "Greater Swiss Mountain Dog",
    "groupName": "Working Group",
    "aliases": [
      "greater-swiss-mountain-dog",
      "Greater Swiss Mountain Dog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1084
  },
  {
    "id": "harrier",
    "nameKo": "Harrier",
    "nameEn": "Harrier",
    "groupName": "Hound Group",
    "aliases": [
      "harrier",
      "Harrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1050
  },
  {
    "id": "ibizan-hound",
    "nameKo": "Ibizan Hound",
    "nameEn": "Ibizan Hound",
    "groupName": "Hound Group",
    "aliases": [
      "ibizan-hound",
      "Ibizan Hound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1051
  },
  {
    "id": "icelandic-sheepdog",
    "nameKo": "Icelandic Sheepdog",
    "nameEn": "Icelandic Sheepdog",
    "groupName": "Herding Group",
    "aliases": [
      "icelandic-sheepdog",
      "Icelandic Sheepdog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1193
  },
  {
    "id": "irish-red-and-white-setter",
    "nameKo": "Irish Red and White Setter",
    "nameEn": "Irish Red and White Setter",
    "groupName": "Sporting Group",
    "aliases": [
      "irish-red-and-white-setter",
      "Irish Red and White Setter"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1018
  },
  {
    "id": "irish-terrier",
    "nameKo": "Irish Terrier",
    "nameEn": "Irish Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "irish-terrier",
      "Irish Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1109
  },
  {
    "id": "irish-water-spaniel",
    "nameKo": "Irish Water Spaniel",
    "nameEn": "Irish Water Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "irish-water-spaniel",
      "Irish Water Spaniel"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1020
  },
  {
    "id": "lakeland-terrier",
    "nameKo": "Lakeland Terrier",
    "nameEn": "Lakeland Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "lakeland-terrier",
      "Lakeland Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1111
  },
  {
    "id": "lancashire-heeler",
    "nameKo": "Lancashire Heeler",
    "nameEn": "Lancashire Heeler",
    "groupName": "Herding Group",
    "aliases": [
      "lancashire-heeler",
      "Lancashire Heeler"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1194
  },
  {
    "id": "mudi",
    "nameKo": "Mudi",
    "nameEn": "Mudi",
    "groupName": "Herding Group",
    "aliases": [
      "mudi",
      "Mudi"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1196
  },
  {
    "id": "nederlandse-kooikerhondje",
    "nameKo": "Nederlandse Kooikerhondje",
    "nameEn": "Nederlandse Kooikerhondje",
    "groupName": "Sporting Group",
    "aliases": [
      "nederlandse-kooikerhondje",
      "Nederlandse Kooikerhondje"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1023
  },
  {
    "id": "norwegian-buhund",
    "nameKo": "Norwegian Buhund",
    "nameEn": "Norwegian Buhund",
    "groupName": "Herding Group",
    "aliases": [
      "norwegian-buhund",
      "Norwegian Buhund"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1197
  },
  {
    "id": "norwegian-lundehund",
    "nameKo": "Norwegian Lundehund",
    "nameEn": "Norwegian Lundehund",
    "groupName": "Non-Sporting Group",
    "aliases": [
      "norwegian-lundehund",
      "Norwegian Lundehund"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1167
  },
  {
    "id": "nova-scotia-duck-tolling-retriever",
    "nameKo": "Nova Scotia Duck Tolling Retriever",
    "nameEn": "Nova Scotia Duck Tolling Retriever",
    "groupName": "Sporting Group",
    "aliases": [
      "nova-scotia-duck-tolling-retriever",
      "Nova Scotia Duck Tolling Retriever"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1024
  },
  {
    "id": "otterhound",
    "nameKo": "Otterhound",
    "nameEn": "Otterhound",
    "groupName": "Hound Group",
    "aliases": [
      "otterhound",
      "Otterhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1054
  },
  {
    "id": "parson-russell-terrier",
    "nameKo": "Parson Russell Terrier",
    "nameEn": "Parson Russell Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "parson-russell-terrier",
      "Parson Russell Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1117
  },
  {
    "id": "petit-basset-griffon-vendeen",
    "nameKo": "Petit Basset Griffon Vendeen",
    "nameEn": "Petit Basset Griffon Vendeen",
    "groupName": "Hound Group",
    "aliases": [
      "petit-basset-griffon-vendeen",
      "Petit Basset Griffon Vendeen"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1055
  },
  {
    "id": "plott-hound",
    "nameKo": "Plott Hound",
    "nameEn": "Plott Hound",
    "groupName": "Hound Group",
    "aliases": [
      "plott-hound",
      "Plott Hound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1057
  },
  {
    "id": "polish-lowland-sheepdog",
    "nameKo": "Polish Lowland Sheepdog",
    "nameEn": "Polish Lowland Sheepdog",
    "groupName": "Herding Group",
    "aliases": [
      "polish-lowland-sheepdog",
      "Polish Lowland Sheepdog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1200
  },
  {
    "id": "portuguese-podengo-pequeno",
    "nameKo": "Portuguese Podengo Pequeno",
    "nameEn": "Portuguese Podengo Pequeno",
    "groupName": "Hound Group",
    "aliases": [
      "portuguese-podengo-pequeno",
      "Portuguese Podengo Pequeno"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1058
  },
  {
    "id": "pumi",
    "nameKo": "Pumi",
    "nameEn": "Pumi",
    "groupName": "Herding Group",
    "aliases": [
      "pumi",
      "Pumi"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1202
  },
  {
    "id": "pyrenean-shepherd",
    "nameKo": "Pyrenean Shepherd",
    "nameEn": "Pyrenean Shepherd",
    "groupName": "Herding Group",
    "aliases": [
      "pyrenean-shepherd",
      "Pyrenean Shepherd"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1203
  },
  {
    "id": "redbone-coonhound",
    "nameKo": "Redbone Coonhound",
    "nameEn": "Redbone Coonhound",
    "groupName": "Hound Group",
    "aliases": [
      "redbone-coonhound",
      "Redbone Coonhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1059
  },
  {
    "id": "russian-toy",
    "nameKo": "Russian Toy",
    "nameEn": "Russian Toy",
    "groupName": "Toy Group",
    "aliases": [
      "russian-toy",
      "Russian Toy"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1148
  },
  {
    "id": "russian-tsvetnaya-bolonka",
    "nameKo": "Russian Tsvetnaya Bolonka",
    "nameEn": "Russian Tsvetnaya Bolonka",
    "groupName": "Toy Group",
    "aliases": [
      "russian-tsvetnaya-bolonka",
      "Russian Tsvetnaya Bolonka"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1149
  },
  {
    "id": "scottish-deerhound",
    "nameKo": "Scottish Deerhound",
    "nameEn": "Scottish Deerhound",
    "groupName": "Hound Group",
    "aliases": [
      "scottish-deerhound",
      "Scottish Deerhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1062
  },
  {
    "id": "sealyham-terrier",
    "nameKo": "Sealyham Terrier",
    "nameEn": "Sealyham Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "sealyham-terrier",
      "Sealyham Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1121
  },
  {
    "id": "skye-terrier",
    "nameKo": "Skye Terrier",
    "nameEn": "Skye Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "skye-terrier",
      "Skye Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1122
  },
  {
    "id": "sloughi",
    "nameKo": "Sloughi",
    "nameEn": "Sloughi",
    "groupName": "Hound Group",
    "aliases": [
      "sloughi",
      "Sloughi"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1063
  },
  {
    "id": "smooth-fox-terrier",
    "nameKo": "Smooth Fox Terrier",
    "nameEn": "Smooth Fox Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "smooth-fox-terrier",
      "Smooth Fox Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1123
  },
  {
    "id": "spanish-water-dog",
    "nameKo": "Spanish Water Dog",
    "nameEn": "Spanish Water Dog",
    "groupName": "Herding Group",
    "aliases": [
      "spanish-water-dog",
      "Spanish Water Dog"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1205
  },
  {
    "id": "spinone-italiano",
    "nameKo": "Spinone Italiano",
    "nameEn": "Spinone Italiano",
    "groupName": "Sporting Group",
    "aliases": [
      "spinone-italiano",
      "Spinone Italiano"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1026
  },
  {
    "id": "sussex-spaniel",
    "nameKo": "Sussex Spaniel",
    "nameEn": "Sussex Spaniel",
    "groupName": "Sporting Group",
    "aliases": [
      "sussex-spaniel",
      "Sussex Spaniel"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1027
  },
  {
    "id": "swedish-vallhund",
    "nameKo": "Swedish Vallhund",
    "nameEn": "Swedish Vallhund",
    "groupName": "Herding Group",
    "aliases": [
      "swedish-vallhund",
      "Swedish Vallhund"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1206
  },
  {
    "id": "teddy-roosevelt-terrier",
    "nameKo": "Teddy Roosevelt Terrier",
    "nameEn": "Teddy Roosevelt Terrier",
    "groupName": "Terrier Group",
    "aliases": [
      "teddy-roosevelt-terrier",
      "Teddy Roosevelt Terrier"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1126
  },
  {
    "id": "treeing-walker-coonhound",
    "nameKo": "Treeing Walker Coonhound",
    "nameEn": "Treeing Walker Coonhound",
    "groupName": "Hound Group",
    "aliases": [
      "treeing-walker-coonhound",
      "Treeing Walker Coonhound"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1064
  },
  {
    "id": "wirehaired-pointing-griffon",
    "nameKo": "Wirehaired Pointing Griffon",
    "nameEn": "Wirehaired Pointing Griffon",
    "groupName": "Sporting Group",
    "aliases": [
      "wirehaired-pointing-griffon",
      "Wirehaired Pointing Griffon"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1031
  },
  {
    "id": "wirehaired-vizsla",
    "nameKo": "Wirehaired Vizsla",
    "nameEn": "Wirehaired Vizsla",
    "groupName": "Sporting Group",
    "aliases": [
      "wirehaired-vizsla",
      "Wirehaired Vizsla"
    ],
    "isPopular": false,
    "source": "akc",
    "sortOrder": 1032
  }
] satisfies DogBreedSeed[];

export const dogBreedIds: readonly string[] = dogBreeds.map((breed) => breed.id);
