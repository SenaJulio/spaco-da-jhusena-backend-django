from django import forms

from .models import Agendamento


class AgendamentoForm(forms.ModelForm):
    class Meta:
        model = Agendamento
        fields = ["nome", "cliente", "telefone", "email", "servico", "data", "hora"]
        widgets = {
            "data": forms.DateInput(attrs={"type": "date"}),
            "hora": forms.TimeInput(attrs={"type": "time"}),
        }
