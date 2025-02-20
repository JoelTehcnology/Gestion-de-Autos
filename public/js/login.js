   // Al cargar la página, esconder el mensaje de error (si lo hay)
   window.onload = function() {
    const alert = document.getElementById('alert');
    alert.style.display = 'none'; // Asegúrate de que el mensaje esté oculto al cargar la página
};

// Interceptar el envío del formulario para manejarlo de forma asíncrona
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();  // Evitar el envío tradicional del formulario

    // Recoger los datos del formulario
    const formData = new FormData(this);
    const data = new URLSearchParams(formData);

    // Realizar la solicitud POST utilizando fetch
    fetch('/login', {
        method: 'POST',
        body: data
    })
    .then(response => response.json())
    .then(result => {
        const alert = document.getElementById('alert');
        const alertText = document.getElementById('alert-text');

        if (result.success) {
            // Si el login es exitoso, redirigir al usuario
            window.location.href = '/TheCompasAutoImportindex';
        } else {
            // Si hay un error, mostrar el mensaje de error en la alerta
            alertText.textContent = result.errorMessage;
            alert.style.display = 'block';

            // Después de 4 segundos, ocultar el mensaje de error
            setTimeout(function() {
                alert.style.display = 'none';
            }, 4000);  // 4000 milisegundos = 4 segundos
        }
    })
    .catch(error => {
        console.error('Error al enviar los datos del login:', error);
    });
});