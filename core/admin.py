from django.contrib import admin
from django.contrib.admin import AdminSite

from agendamentos.models import Agendamento
from estoque.models import ItemEstoque
from financeiro.models import Transacao
from produtos.models import Produto
from servicos.models import Servico
from usuarios.models import Usuario


from .models import Empresa, Perfil

@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ("id", "nome", "plano", "ativa", "criado_em")
    list_filter = ("plano", "ativa")
    search_fields = ("nome",)

@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "empresa")
    search_fields = ("user__username", "empresa__nome")


class SpaçoJhusenaAdminSite(AdminSite):
    site_header = "🐶 Spaço da Jhuséna Admin"
    site_title = "Painel Spaço da Jhuséna"
    index_title = "Bem-vindo ao Controle Geral 💚"

    class Media:
        css = {"all": ("87332css/admin_custom.css",)}


spaço_admin = SpaçoJhusenaAdminSite(name="spaço_admin")

# Registrar todos os modelos que quiser centralizar
spaço_admin.register(Agendamento)
spaço_admin.register(Transacao)
spaço_admin.register(Servico)
spaço_admin.register(Produto)
spaço_admin.register(Usuario)
spaço_admin.register(ItemEstoque)

admin.site.site_header = "🐶 Spaço da Jhuséna Admin"
admin.site.site_title = "Painel Administrativo"
admin.site.index_title = "Bem-vindo ao Controle Geral 💚"


# Register your models here.
