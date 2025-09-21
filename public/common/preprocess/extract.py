import os
import json
import re

# Initialize lists and sets
states = []
all_provinces_set = set()
duplicates = set()

# Read provinces.json to filter out ocean provinces
with open('provinces.json', 'r') as f:
    provinces_data = json.load(f)
non_ocean_provinces = set(p['id'] for p in provinces_data if p['type'] == 'land')
expected_non_ocean = len(non_ocean_provinces)

# Assume files are in the current directory; change '.' to your folder path if needed
folder_path = 'states'

for filename in os.listdir(folder_path):
    if filename.endswith('.txt'):
        # Parse filename: "84-Transylvania.txt" -> id=84, name="Transylvania"
        parts = filename[:-4].split('-', 1)
        if len(parts) != 2:
            print(f"Skipping invalid filename: {filename}")
            continue
        try:
            state_id = int(parts[0].strip())
            state_name = parts[1].strip()
        except ValueError:
            print(f"Skipping invalid state ID in filename: {filename}")
            continue

        # Read file content
        file_path = os.path.join(folder_path, filename)
        with open(file_path, 'r') as f:
            content = f.read()

        # Extract provinces using regex to handle potential multiline or formatting
        match = re.search(r'provinces\s*=\s*\{\s*([\d\s]+)\s*\}', content, re.DOTALL)
        if not match:
            print(f"No provinces found in {filename}")
            continue
        prov_str = match.group(1)
        provinces = [int(p.strip()) for p in prov_str.split() if p.strip().isdigit()]

        # Add to states list
        states.append({'id': state_id, 'name': state_name, 'provinces': provinces})

        # Check for duplicates and collect unique provinces
        for p in provinces:
            if p in all_provinces_set:
                duplicates.add(p)
            all_provinces_set.add(p)

# Sort states by ID
states.sort(key=lambda x: x['id'])

# Check for anomalies
total_unique = len(all_provinces_set)
missing = non_ocean_provinces - all_provinces_set
if total_unique != expected_non_ocean or missing or duplicates:
    print(f"Anomalies detected:")
    print(f"Unique provinces: {total_unique}, expected (non-ocean): {expected_non_ocean}")
    if duplicates:
        print(f"Duplicate provinces: {sorted(duplicates)}")
    if missing:
        print(f"Missing non-ocean provinces: {sorted(missing)}")
else:
    print("No anomalies detected")

# Write to states.json
with open('states.json', 'w') as f:
    json.dump(states, f)

print("Extraction complete. Results stored in states.json")
