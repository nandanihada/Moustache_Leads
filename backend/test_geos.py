from pymongo import MongoClient

client = MongoClient('mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true')
db_instance = client['ascend_db']
offers = db_instance.get_collection('offers').find({"network": {"$regex": "lootably", "$options": "i"}})

excluded = {
    'AQ', 'BV', 'HM', 'IO', 'TF', 'UM', 'GS', 'PN', 'CC', 'CX',
    'TK', 'NU', 'NF', 'WF', 'NC', 'PF', 'MP', 'AS', 'FM', 'MH', 'PW', 'NR', 'TV', 'KI', 'CK',
    'SJ', 'FK', 'BL', 'MF', 'PM', 'SH', 'TA', 'VG', 'AI', 'MS', 'TC', 'SX', 'CW', 'BQ', 'AW', 'BM', 'GL', 'FO', 'AX',
    'SM', 'VA', 'MC', 'LI', 'AD', 'EH', 'XK', 'YT', 'KM', 'ST', 'GW', 'GQ', 'DJ', 'ER', 'SO', 'SS',
    'A1', 'A2', 'O1', 'AP', 'EU', 'WW', 'GLOBAL', 'ALL'
}

geos = set()
for o in offers:
    c_list = o.get('countries', [])
    if not isinstance(c_list, list):
        c_list = [c_list]
    for c in c_list:
        if c:
            for piece in str(c).replace('|', ',').split(','):
                pc = piece.strip().upper()
                if pc == 'UK': pc = 'GB'
                if pc in ['ALL', 'GLOBAL', 'WW']: pc = 'WW'
                if pc and pc not in excluded:
                    geos.add(pc)
                    
print(f"Total unique raw geos: {len(geos)}")
# print(sorted(list(geos)))
