from django import forms
from django.core.exceptions import ValidationError
from .models import Agendamento


class AgendamentoForm(forms.ModelForm):
    # garante input date/time com formatos
    data = forms.DateField(
        input_formats=["%Y-%m-%d", "%d/%m/%Y"],
        widget=forms.DateInput(attrs={"type": "date", "class": "form-control"}, format="%Y-%m-%d"),
    )
    hora = forms.TimeField(
        input_formats=["%H:%M", "%H:%M:%S"],
        widget=forms.TimeInput(
            attrs={"type": "time", "class": "form-control", "step": "60"}, format="%H:%M"
        ),
    )

    class Meta:
        model = Agendamento
        # ✅ pet_nome é texto digitável (precisa existir no model)
        fields = ["nome", "pet_nome", "telefone", "email", "servico", "data", "hora"]
        widgets = {
            "nome": forms.TextInput(attrs={"class": "form-control"}),
            "pet_nome": forms.TextInput(attrs={"class": "form-control"}),
            "telefone": forms.TextInput(attrs={"class": "form-control"}),
            "email": forms.EmailInput(attrs={"class": "form-control"}),
            "servico": forms.Select(attrs={"class": "form-select"}),
        }

    def clean(self):
        cleaned = super().clean()
        data = cleaned.get("data")
        hora = cleaned.get("hora")

        if not data or not hora:
            return cleaned

        # ✅ 1 agendamento por horário NO GERAL
        qs = Agendamento.objects.filter(data=data, hora=hora)

        # se for edição, ignora o próprio registro
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise ValidationError("Esse horário já está ocupado. Escolha outro horário.")

        return cleaned
