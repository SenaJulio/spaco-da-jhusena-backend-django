from django import forms
from .models import Agendamento


class AgendamentoForm(forms.ModelForm):
    data = forms.DateField(
        input_formats=["%Y-%m-%d", "%d/%m/%Y"],
        widget=forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
    )
    hora = forms.TimeField(
        input_formats=["%H:%M", "%H:%M:%S"],
        widget=forms.TimeInput(attrs={"type": "time", "step": "60"}, format="%H:%M"),
    )

    class Meta:
        model = Agendamento
        fields = ["nome", "cliente", "telefone", "email", "servico", "data", "hora"]


class AgendamentoForm(forms.ModelForm):
    class Meta:
        model = Agendamento
        fields = ["nome", "cliente", "telefone", "email", "servico", "data", "hora"]
        widgets = {
            "nome": forms.TextInput(attrs={"class": "form-control"}),
            "cliente": forms.Select(attrs={"class": "form-select"}),
            "telefone": forms.TextInput(attrs={"class": "form-control"}),
            "email": forms.EmailInput(attrs={"class": "form-control"}),
            "servico": forms.Select(attrs={"class": "form-select"}),
            "data": forms.DateInput(attrs={"type": "date", "class": "form-control"}),
            "hora": forms.TimeInput(attrs={"type": "time", "class": "form-control"}),
        }
