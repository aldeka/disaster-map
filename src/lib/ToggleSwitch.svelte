<script>
    // based on suggestions from:
    // Inclusive Components by Heydon Pickering https://inclusive-components.design/toggle-button/
    // On Designing and Building Toggle Switches by Sara Soueidan https://www.sarasoueidan.com/blog/toggle-switch-design/
    // and this example by Scott O'hara https://codepen.io/scottohara/pen/zLZwNv 

    let {
      label,
      fontSize = 16, 
      accentColor = "CornflowerBlue", 
      value = $bindable(false)
    } = $props();

		const uniqueID = Math.floor(Math.random() * 100)

    function handleClick(event){
        value = !value;
    }
	
	  const slugify = (str = "") =>
    str.toLowerCase().replace(/ /g, "-").replace(/\./g, "");

</script>

<div class="s s--slider" style:font-size="{fontSize}px" style:--accent-color={accentColor}>
    <button
        role="switch"
        aria-checked={value}
        aria-labelledby={`switch-${uniqueID}`}
        onclick={handleClick}>
    </button>
    <span id={`switch-${uniqueID}`}>{label}</span>
</div>

<style>
			:root {
		--gray: #c0b9b9;
	}

    /* Slider Design Option */

    .s--slider {
        display: flex;
        align-items: center;
    }

    .s--slider button {
        width: calc(3em + 4px);
        height: calc(1.4em + 4px);
        position: relative;
        margin: 0;
        background: color-mix(in srgb, var(--gray), white 40%);
        border: 2px solid var(--gray);
    }

    .s--slider button::before {
        content: '';
        position: absolute;
        width: 1.4em;
        height: 1.4em;
        background: #fff;
        box-shadow: 1px 0px 4px rgba(0, 0, 0, 0.1);
        top: 0em;
        right: 1.5em;
        transition: transform 0.3s;
    }

    .s--slider button[aria-checked='true']{
        border-color: color-mix(in srgb, var(--accent-color), white 10%);
        background-color: color-mix(in srgb, var(--accent-color), white 30%);
    }

    .s--slider button[aria-checked='true']::before{
        transform: translateX(1.4em);
        transition: transform 0.3s;
        box-shadow: -1px 0px 3px rgba(0, 0, 0, 0.1);
    }

    .s--slider button {
        border-radius: calc(1.5em + 1px);
    } 
    
    .s--slider button::before {
        border-radius: 100%;
    }

    .s--slider button:focus {
        box-shadow: 0 0px 6px color-mix(in srgb, var(--accent-color), #0000007b 50%);
        border-radius: calc(1.5em + 1px);
    }

    .s--slider span {
      margin-left: 0.5em;
    }
</style>