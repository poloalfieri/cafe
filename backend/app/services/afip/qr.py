import base64
import json
from io import BytesIO
from typing import Any, Dict

import qrcode


ARCA_QR_BASE_URL = "https://www.arca.gob.ar/fe/qr/?p="


def build_qr_url(data: Dict[str, Any]) -> str:
    payload = {
        "ver": 1,
        "fecha": data["fecha"],
        "cuit": int(data["cuit"]),
        "ptoVta": int(data["ptoVta"]),
        "tipoCmp": int(data["tipoCmp"]),
        "nroCmp": int(data["nroCmp"]),
        "importe": float(data["importe"]),
        "moneda": data.get("moneda", "PES"),
        "ctz": float(data.get("ctz", 1)),
        "tipoDocRec": int(data["tipoDocRec"]),
        "nroDocRec": int(data["nroDocRec"]),
        "tipoCodAut": "E",
        "codAut": int(data["codAut"]),
    }

    serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    encoded = base64.b64encode(serialized.encode("utf-8")).decode("ascii")
    return f"{ARCA_QR_BASE_URL}{encoded}"


def build_qr_image_b64(qr_url: str) -> str:
    if not qr_url:
        return ""

    image = qrcode.make(qr_url)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")
