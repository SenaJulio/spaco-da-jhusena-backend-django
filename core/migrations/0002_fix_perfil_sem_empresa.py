from django.db import migrations


def corrigir_perfis_sem_empresa(apps, schema_editor):
    Perfil = apps.get_model("core", "Perfil")
    Empresa = apps.get_model("core", "Empresa")

    db = schema_editor.connection.alias

    empresa = Empresa.objects.using(db).order_by("id").first()
    if not empresa:
        # sem empresa não há o que fazer
        return

    # corrige todos os perfis órfãos
    for perfil in Perfil.objects.using(db).filter(empresa__isnull=True):
        perfil.empresa = empresa
        perfil.save(update_fields=["empresa"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(corrigir_perfis_sem_empresa),
    ]
