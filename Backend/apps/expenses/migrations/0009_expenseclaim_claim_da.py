from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0008_expenseclaim_claim_remark'),
    ]

    operations = [
        migrations.AddField(
            model_name='expenseclaim',
            name='claim_da',
            field=models.BooleanField(
                default=True,
                help_text='Whether the employee opted to claim Daily Allowance (DA). '
                          'If False, DA is set to 0 and only Incidentals are calculated.'
            ),
        ),
    ]
