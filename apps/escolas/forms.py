from django import forms

from apps.accounts.models import User

from .models import Aluno, Professor, Turma


class ProfessorForm(forms.ModelForm):
    """Form para criar/editar professor — usado pelo diretor."""
    first_name = forms.CharField(label='Nome', max_length=150)
    last_name = forms.CharField(label='Sobrenome', max_length=150)
    email = forms.EmailField(label='Email')
    username = forms.CharField(label='Usuário', max_length=150)
    password = forms.CharField(
        label='Senha',
        widget=forms.PasswordInput,
        required=False,
        help_text='Deixe vazio para manter a senha atual (ao editar).',
    )

    class Meta:
        model = Professor
        fields = ('ativo',)

    def __init__(self, *args, escola=None, **kwargs):
        self.escola = escola
        instance = kwargs.get('instance')

        initial = kwargs.get('initial', {})
        if instance and instance.pk:
            initial['first_name'] = instance.user.first_name
            initial['last_name'] = instance.user.last_name
            initial['email'] = instance.user.email
            initial['username'] = instance.user.username
        kwargs['initial'] = initial

        super().__init__(*args, **kwargs)

        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = 'form-control'

        if instance and instance.pk:
            self.fields['username'].disabled = True

    def clean_username(self):
        username = self.cleaned_data['username']
        qs = User.objects.filter(username=username)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise forms.ValidationError('Este usuário já existe.')
        return username

    def clean_email(self):
        email = self.cleaned_data['email']
        qs = User.objects.filter(email=email)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise forms.ValidationError('Este email já está em uso.')
        return email

    def save(self, commit=True):
        professor = super().save(commit=False)
        professor.escola = self.escola

        if professor.pk:
            user = professor.user
            user.first_name = self.cleaned_data['first_name']
            user.last_name = self.cleaned_data['last_name']
            user.email = self.cleaned_data['email']
            if self.cleaned_data.get('password'):
                user.set_password(self.cleaned_data['password'])
            user.save()
        else:
            user = User.objects.create_user(
                username=self.cleaned_data['username'],
                email=self.cleaned_data['email'],
                first_name=self.cleaned_data['first_name'],
                last_name=self.cleaned_data['last_name'],
                password=self.cleaned_data.get('password') or 'mudar123',
                role='professor',
            )
            professor.user = user

        if commit:
            professor.save()
        return professor


class TurmaForm(forms.ModelForm):
    class Meta:
        model = Turma
        fields = ('year', 'nome', 'professor')

    def __init__(self, *args, escola=None, **kwargs):
        self.escola = escola
        super().__init__(*args, **kwargs)
        if escola:
            self.fields['professor'].queryset = Professor.objects.filter(escola=escola)
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-control'

    def save(self, commit=True):
        turma = super().save(commit=False)
        turma.escola = self.escola
        if commit:
            turma.save()
        return turma


class AlunoForm(forms.ModelForm):
    class Meta:
        model = Aluno
        fields = ('nome', 'turma')

    def __init__(self, *args, escola=None, **kwargs):
        super().__init__(*args, **kwargs)
        if escola:
            self.fields['turma'].queryset = Turma.objects.filter(escola=escola)
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-control'
