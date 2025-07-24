import csv
import json

def rgb_to_hex(r, g, b):
    return f"{r:02x}{g:02x}{b:02x}"

def convert_csv_to_json(input_csv, output_json):
    provinces = []
    with open(input_csv, 'r') as file:
        reader = csv.reader(file, delimiter=';')
        next(reader)
        for row in reader:
            print(row)
            province = {
                "id": int(row[0]),
                "color": rgb_to_hex(int(row[1]), int(row[2]), int(row[3])),
                "type": row[4]
            }
            provinces.append(province)
    with open(output_json, 'w') as file:
        json.dump(provinces, file)

if __name__ == "__main__":
    convert_csv_to_json("definition.csv", "provinces.json")
