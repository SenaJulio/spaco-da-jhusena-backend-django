def classificar_margem(margem_pct: float) -> str:
    if margem_pct >= 15.0:
        return "positiva"
    if margem_pct <= 0 or margem_pct < 5.0:
        return "alerta"
    return "neutra"
