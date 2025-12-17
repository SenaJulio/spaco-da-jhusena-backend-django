from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def dashboard_estoque(request):
    """
    Página principal do Dashboard de Estoque
    """
    return render(request, "estoque/dashboard.html")
