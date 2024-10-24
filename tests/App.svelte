<script>
    let name = 'World';
  </script>
  
  <main>
    <h1>Hello {name}!</h1>
    <input type="text" bind:value={name} placeholder="Enter your name" />
  </main>
  
  <style>
    main {
      text-align: center;
      padding: 1em;
    }
  
    h1 {
      color: #ff3e00;
    }
  </style>