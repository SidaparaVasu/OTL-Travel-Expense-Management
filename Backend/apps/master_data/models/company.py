from django.db import models

class CompanyInformation(models.Model):
    """
    Company/Organization master data
    """
    name = models.CharField(max_length=100, unique=True)
    address = models.TextField()
    pincode = models.CharField(max_length=10)
    phone_number = models.CharField(max_length=15, blank=True)
    website = models.URLField(blank=True)
    email_address = models.EmailField(blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    header = models.CharField(max_length=255, blank=True)
    footer = models.CharField(max_length=255, blank=True)
    signature = models.ImageField(upload_to='signatures/', blank=True, null=True)
    
    def __str__(self):
        return self.name

class DepartmentMaster(models.Model):
    """
    Department master data
    """
    department_id = models.AutoField(primary_key=True)
    dept_name = models.CharField(max_length=255, unique=True)
    dept_code = models.CharField(max_length=50)
    description = models.CharField(max_length=200, null=True, blank=True)
    company = models.ForeignKey(CompanyInformation, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['company', 'dept_name'], name='unique_department_name_per_company'),
            # models.UniqueConstraint(fields=['company', 'dept_code'], name='unique_department_code_per_company')
        ]

    def __str__(self):
        return self.dept_name

class DesignationMaster(models.Model):
    """
    Designation master data
    """
    designation_id = models.AutoField(primary_key=True)
    designation_name = models.CharField(max_length=255)
    designation_code = models.CharField(max_length=50)
    description = models.CharField(max_length=200, null=True, blank=True)
    department = models.ForeignKey(
        'DepartmentMaster', 
        on_delete=models.CASCADE, 
        related_name='designations',
        null=True,  # Optional: if you want to allow designations without department initially
        blank=True
    )

    def __str__(self):
        return self.designation_name
    
class EmployeeTypeMaster(models.Model):
    """
    Employee type master data (On-Roll, Contract, Consultant, etc.)
    """
    type = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.type