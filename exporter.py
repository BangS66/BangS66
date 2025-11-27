import csv
import json

def export_json(data, filename="contacts.json", **kwargs): # Accept extra args
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def export_csv(data, filename="contacts.csv", prefix="Contact"):
    with open(filename, "w", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Phone", "Source Chat"])
        for i, row in enumerate(data, start=1):
            name = f"{prefix} {str(i).zfill(2)}"
            writer.writerow([name, row.get("phone",""), row.get("chat","")])

def export_vcf(data, filename="contacts.vcf", prefix="Contact"):
    with open(filename, "w", encoding="utf-8") as f:
        for i, row in enumerate(data, start=1):
            phone = row.get("phone", "")
            name = f"{prefix} {str(i).zfill(2)}"
            # Simple vCard entry
            f.write("BEGIN:VCARD\n")
            f.write("VERSION:3.0\n")
            f.write(f"N:{name};;;;\n")
            f.write(f"FN:{name}\n")
            f.write(f"TEL;TYPE=CELL:{phone}\n")
            f.write("END:VCARD\n")
